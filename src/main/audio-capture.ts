import { BrowserWindow, IpcMainEvent } from 'electron'

export type AudioSource = 'microphone' | 'system' | 'both'

// Note: Actual audio capture happens in the renderer process
// because MediaRecorder and getUserMedia are Web APIs.
// This class coordinates the capture via IPC.
export class AudioCapture {
  private recording = false
  private mainWindow: BrowserWindow | null = null

  async startRecording(source: AudioSource, mainWindow: BrowserWindow): Promise<void> {
    this.mainWindow = mainWindow
    this.recording = true

    // Tell the renderer to start capturing
    mainWindow.webContents.send('audio:start-capture', source)
  }

  async stopRecording(): Promise<Buffer> {
    if (!this.mainWindow) {
      throw new Error('No recording in progress')
    }

    this.recording = false

    // Request the audio data from renderer
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for audio data'))
      }, 5000)

      this.mainWindow!.webContents.send('audio:stop-capture')

      // The renderer will send back the audio data
      const { ipcMain } = require('electron')
      ipcMain.once('audio:capture-complete', (_event: IpcMainEvent, buffer: Buffer) => {
        clearTimeout(timeout)
        resolve(buffer)
      })

      ipcMain.once('audio:capture-error', (_event: IpcMainEvent, error: string) => {
        clearTimeout(timeout)
        reject(new Error(error))
      })
    })
  }

  isRecording(): boolean {
    return this.recording
  }
}

// For reference: The actual audio capture code that runs in the renderer process
// is in src/renderer/hooks/use-audio-capture.ts
// It uses the Web Audio API and MediaRecorder to capture audio.
