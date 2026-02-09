import WebSocket from 'ws'
import { EventEmitter } from 'events'

export interface TranscriptResult {
  text: string
}

export interface WhisperLocalConfig {
  serverUrl: string
  language: string
}

const DEFAULT_CONFIG: WhisperLocalConfig = {
  serverUrl: 'ws://127.0.0.1:8765/stream',
  language: 'en'
}

export class WhisperLocalService extends EventEmitter {
  private config: WhisperLocalConfig
  private ws: WebSocket | null = null
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  constructor(config: Partial<WhisperLocalConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.config.serverUrl, {
          // Increase timeouts to handle slow transcription
          handshakeTimeout: 10000,
          // Enable per-message deflate can help with large messages
          perMessageDeflate: false
        })

        this.ws.on('open', () => {
          console.log('[whisper-local] WebSocket connected to Whisper server')
          this.isConnected = true
          this.reconnectAttempts = 0

          // Send config
          console.log('[whisper-local] Sending config with language:', this.config.language)
          this.ws?.send(
            JSON.stringify({
              type: 'config',
              language: this.config.language
            })
          )
        })

        // Handle ping/pong to keep connection alive
        this.ws.on('ping', () => {
          console.log('[whisper-local] Received ping, sending pong')
          this.ws?.pong()
        })

        this.ws.on('pong', () => {
          console.log('[whisper-local] Received pong')
        })

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString())
            console.log('[whisper-local] Received from Whisper server:', message.type)

            switch (message.type) {
              case 'ready':
                console.log('[whisper-local] Whisper server ready, resolving connection')
                this.emit('ready')
                resolve(true)
                break

              case 'transcript':
                console.log(`[whisper-local] Received transcript, text: ${message.text?.slice(0, 80)}...`)
                this.emit('transcript', {
                  text: message.text
                } as TranscriptResult)
                break

              case 'done':
                console.log('[whisper-local] Received done signal from server')
                this.emit('done')
                break

              case 'error':
                this.emit('error', new Error(message.message))
                break
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err)
          }
        })

        this.ws.on('error', (err) => {
          console.error('WebSocket error:', err)
          this.emit('error', err)
          if (!this.isConnected) {
            resolve(false)
          }
        })

        this.ws.on('close', (code, reason) => {
          console.log(`[whisper-local] WebSocket closed. Code: ${code}, Reason: ${reason}`)
          this.isConnected = false
          this.emit('disconnected')
        })

        // Timeout for connection
        setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close()
            resolve(false)
          }
        }, 5000)
      } catch (err) {
        console.error('Failed to create WebSocket:', err)
        resolve(false)
      }
    })
  }

  sendAudio(audioData: Buffer): void {
    if (!this.isConnected || !this.ws) {
      console.warn('Not connected to Whisper server')
      return
    }

    console.log('Sending audio to Whisper server:', audioData.length, 'bytes')
    this.ws.send(
      JSON.stringify({
        type: 'audio',
        data: audioData.toString('base64')
      })
    )
  }

  async stop(): Promise<void> {
    console.log('[whisper-local] stop() called, ws:', !!this.ws, 'isConnected:', this.isConnected)
    if (!this.ws) return

    return new Promise((resolve) => {
      if (this.isConnected) {
        console.log('[whisper-local] Sending stop signal to Whisper server...')
        this.ws?.send(JSON.stringify({ type: 'stop' }))

        // Wait for 'done' message
        const timeout = setTimeout(() => {
          console.log('[whisper-local] Stop timeout reached, disconnecting')
          this.disconnect()
          resolve()
        }, 10000) // 10 second timeout for processing final audio chunk

        this.once('done', () => {
          console.log('[whisper-local] Received done signal from server in stop() handler')
          clearTimeout(timeout)
          this.disconnect()
          resolve()
        })
      } else {
        console.log('[whisper-local] Not connected, just disconnecting')
        this.disconnect()
        resolve()
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
  }

  getIsConnected(): boolean {
    return this.isConnected
  }
}

// HTTP client for batch transcription
export async function transcribeFile(
  audioBuffer: Buffer,
  language = 'en',
  serverUrl = 'http://127.0.0.1:8765'
): Promise<{
  success: boolean
  text: string
  segments: Array<{ id: number; start: number; end: number; text: string }>
  language: string
  duration: number
}> {
  const formData = new FormData()
  const blob = new Blob([audioBuffer], { type: 'audio/webm' })
  formData.append('file', blob, 'audio.webm')

  const response = await fetch(`${serverUrl}/transcribe?language=${language}`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.status}`)
  }

  return response.json()
}

// Check if the Whisper server is running
export async function checkWhisperServer(
  serverUrl = 'http://127.0.0.1:8765'
): Promise<boolean> {
  try {
    const response = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    return response.ok
  } catch {
    return false
  }
}
