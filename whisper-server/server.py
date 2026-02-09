#!/usr/bin/env python3
"""
Local Whisper transcription server using faster-whisper.
Provides both HTTP and WebSocket endpoints for real-time transcription.
"""

import io
import os
import tempfile
import asyncio
from typing import Optional, List
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import uvicorn

# Thread pool for running blocking transcription
transcription_executor = ThreadPoolExecutor(max_workers=2)

# Configuration
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")  # tiny, base, small, medium, large-v3
DEVICE = os.environ.get("WHISPER_DEVICE", "auto")  # cpu, cuda, auto
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")  # float16, int8, int8_float16
BATCH_SIZE = int(os.environ.get("WHISPER_BATCH_SIZE", "3"))  # Number of 1-second chunks before transcription

app = FastAPI(title="Whisper Transcription Server")

# CORS for Electron app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
model: Optional[WhisperModel] = None


def get_model() -> WhisperModel:
    """Lazy load the Whisper model."""
    global model
    if model is None:
        print(f"Loading Whisper model: {MODEL_SIZE} on {DEVICE} with {COMPUTE_TYPE}")
        model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        print("Model loaded successfully")
    return model


def transcribe_sync(tmp_path: str, language: str) -> List[str]:
    """Synchronous transcription - runs in thread pool."""
    whisper = get_model()
    segments, _ = whisper.transcribe(
        tmp_path,
        language=language,
        beam_size=5,
        vad_filter=True,
    )
    return [seg.text.strip() for seg in segments if seg.text.strip()]


async def transcribe_async(tmp_path: str, language: str) -> List[str]:
    """Run transcription in thread pool to avoid blocking async loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        transcription_executor,
        transcribe_sync,
        tmp_path,
        language
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model": MODEL_SIZE,
        "device": DEVICE,
    }


@app.post("/transcribe")
async def transcribe_file(
    file: UploadFile = File(...),
    language: str = "en"
):
    """
    Transcribe an uploaded audio file.
    Accepts WAV, MP3, WebM, or any format ffmpeg can decode.
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            whisper = get_model()
            segments_gen, info = whisper.transcribe(
                tmp_path,
                language=language if language else None,
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
            )

            result_segments = []
            full_text = []

            for segment in segments_gen:
                result_segments.append({
                    "id": segment.id,
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip(),
                    "confidence": segment.avg_logprob,
                })
                full_text.append(segment.text.strip())

            return {
                "success": True,
                "language": info.language,
                "duration": info.duration,
                "segments": result_segments,
                "text": " ".join(full_text),
            }

        finally:
            # Clean up temp file
            os.unlink(tmp_path)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/stream")
async def websocket_transcribe(websocket: WebSocket):
    """
    WebSocket endpoint for streaming transcription.

    Protocol:
    - Client sends: {"type": "config", "language": "en"} to configure
    - Client sends: {"type": "audio", "data": "<base64 audio>"} for audio chunks
    - Client sends: {"type": "stop"} to end session
    - Server sends: {"type": "transcript", "text": "..."}
    """
    await websocket.accept()
    print("WebSocket client connected")

    # Set keepalive to prevent disconnection during long transcription
    # This is important because transcription can take 5-10 seconds
    websocket.scope["session"] = {"keepalive": True}

    language = "en"
    audio_buffer = io.BytesIO()
    chunk_count = 0
    total_chunks = 0

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            print(f"Received message type: {msg_type}")

            if msg_type == "config":
                language = data.get("language", "en")
                print(f"Configured: language={language}")
                await websocket.send_json({"type": "ready"})

            elif msg_type == "audio":
                import base64
                audio_data = base64.b64decode(data.get("data", ""))
                audio_buffer.write(audio_data)
                chunk_count += 1
                total_chunks += 1
                print(f"Received audio chunk {total_chunks}, size: {len(audio_data)} bytes")

                # Process every BATCH_SIZE seconds for streaming feedback
                # Important: We transcribe the ENTIRE accumulated audio, not just the new chunk
                # This is because MediaRecorder sends WebM fragments, not complete files
                if chunk_count >= BATCH_SIZE:
                    buffer_data = audio_buffer.getvalue()

                    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
                        tmp.write(buffer_data)
                        tmp_path = tmp.name

                    try:
                        text_parts = await transcribe_async(tmp_path, language)

                        if text_parts:
                            transcript_text = " ".join(text_parts)
                            print(f"Transcribed ({total_chunks} chunks, {len(buffer_data)} bytes): {transcript_text[:80]}...")

                            # Check if websocket is still connected before sending
                            try:
                                await websocket.send_json({
                                    "type": "transcript",
                                    "text": transcript_text,
                                })
                            except Exception as send_error:
                                print(f"Failed to send transcript (client may have disconnected): {send_error}")
                                # Don't break - client might reconnect or this is temporary

                    except Exception as e:
                        print(f"Transcription error: {e}")
                        import traceback
                        traceback.print_exc()

                    finally:
                        os.unlink(tmp_path)

                    # Reset chunk counter but keep accumulating audio
                    chunk_count = 0

            elif msg_type == "stop":
                print("Stop received, processing any remaining audio...")

                # Process any remaining audio in buffer
                buffer_data = audio_buffer.getvalue()
                if len(buffer_data) > 0:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
                        tmp.write(buffer_data)
                        tmp_path = tmp.name

                    try:
                        text_parts = await transcribe_async(tmp_path, language)

                        if text_parts:
                            transcript_text = " ".join(text_parts)
                            print(f"Final chunk transcribed: {transcript_text[:80]}...")
                            await websocket.send_json({
                                "type": "transcript",
                                "text": transcript_text,
                            })

                    except Exception as e:
                        print(f"Final transcription error: {e}")

                    finally:
                        os.unlink(tmp_path)

                await websocket.send_json({"type": "done"})
                print("Session complete")
                break

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass


def main():
    """Entry point for the server."""
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║           Whisper Transcription Server                        ║
╠═══════════════════════════════════════════════════════════════╣
║  Model: {MODEL_SIZE:<10}  Device: {DEVICE:<10}  Compute: {COMPUTE_TYPE:<10} ║
║  Batch: {BATCH_SIZE} chunks (~{BATCH_SIZE}s latency)                                  ║
╠═══════════════════════════════════════════════════════════════╣
║  HTTP:  POST /transcribe  - Upload audio file                 ║
║  WS:    /stream           - Real-time streaming               ║
║  GET:   /health           - Health check                      ║
╚═══════════════════════════════════════════════════════════════╝
    """)

    uvicorn.run(app, host="127.0.0.1", port=8765)


if __name__ == "__main__":
    main()
