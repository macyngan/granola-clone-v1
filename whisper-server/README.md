# Whisper Transcription Server

Local speech-to-text server using [faster-whisper](https://github.com/guillaumekln/faster-whisper).

## Requirements

- Python 3.9+
- [Poetry](https://python-poetry.org/docs/#installation)
- ~2GB RAM for `base` model
- ~4GB RAM for `small` model
- ~8GB RAM for `large-v3` model

## Setup with Poetry

### 1. Install Poetry (if not installed)

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

### 2. Install dependencies

```bash
cd whisper-server
poetry install
```

### 3. Start the server

```bash
poetry run python server.py
```

Or use the shell:

```bash
poetry shell
python server.py
```

The server runs at `http://127.0.0.1:8765`.

## Configuration

Environment variables:

| Variable | Default | Options |
|----------|---------|---------|
| `WHISPER_MODEL` | `base` | `tiny`, `base`, `small`, `medium`, `large-v3` |
| `WHISPER_DEVICE` | `auto` | `cpu`, `cuda`, `auto` |
| `WHISPER_COMPUTE_TYPE` | `int8` | `float16`, `int8`, `int8_float16` |

Example with a larger model:

```bash
WHISPER_MODEL=small poetry run python server.py
```

## Model Sizes

| Model | Size | RAM Required | Speed (rel.) |
|-------|------|--------------|--------------|
| tiny | 39M | ~1GB | 1x |
| base | 74M | ~2GB | 1x |
| small | 244M | ~4GB | 0.5x |
| medium | 769M | ~6GB | 0.3x |
| large-v3 | 1.5G | ~8GB | 0.15x |

For real-time transcription, `base` or `small` is recommended.

## API Endpoints

### POST /transcribe

Upload an audio file for batch transcription.

```bash
curl -X POST http://127.0.0.1:8765/transcribe \
  -F "file=@audio.webm" \
  -F "language=en"
```

Response:
```json
{
  "success": true,
  "language": "en",
  "duration": 10.5,
  "text": "Hello, this is a test.",
  "segments": [
    {"id": 0, "start": 0.0, "end": 2.5, "text": "Hello,", "confidence": -0.5}
  ]
}
```

### WebSocket /stream

Real-time streaming transcription.

1. Connect to `ws://127.0.0.1:8765/stream`
2. Send config: `{"type": "config", "language": "en"}`
3. Send audio chunks: `{"type": "audio", "data": "<base64 audio>"}`
4. Receive transcripts: `{"type": "transcript", "text": "...", "is_final": false}`
5. Send stop: `{"type": "stop"}`

### GET /health

Check server status.

```bash
curl http://127.0.0.1:8765/health
```

## Troubleshooting

### "command not found: poetry"

Add Poetry to your PATH:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Slow transcription

- Use a smaller model (`base` instead of `large-v3`)
- Ensure CUDA is available for GPU acceleration
- Check `WHISPER_DEVICE=auto` is detecting your GPU

### High memory usage

- Use `int8` compute type: `WHISPER_COMPUTE_TYPE=int8`
- Use a smaller model

### Apple Silicon (M1/M2/M3)

faster-whisper works well on Apple Silicon with CPU:
```bash
WHISPER_DEVICE=cpu poetry run python server.py
```

### Install Manually
```bash
# First install basic dependencies
poetry install

# Then install scipy binary (avoids building from source)
poetry run pip install scipy --only-binary=:all:

# Then install pyannote-audio and torch
poetry run pip install pyannote-audio torch
```

