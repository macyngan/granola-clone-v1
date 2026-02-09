import { ipcMain, BrowserWindow, desktopCapturer, systemPreferences } from 'electron'
import { AudioCapture } from './audio-capture'
import { callLLM, streamLLM } from './llm/client'
import { WhisperLocalService, checkWhisperServer } from './transcription/whisper-local'
import { defaultConfig, getModelConfig } from '@shared/config/models'
import type { ChatMessage } from '@shared/types'
import * as db from './db/queries'

let audioCapture: AudioCapture | null = null
let whisperService: WhisperLocalService | null = null

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ============================================
  // Audio Capture
  // ============================================

  ipcMain.handle('audio:request-permissions', async () => {
    if (process.platform === 'darwin') {
      const micStatus = systemPreferences.getMediaAccessStatus('microphone')
      if (micStatus !== 'granted') {
        const granted = await systemPreferences.askForMediaAccess('microphone')
        if (!granted) return false
      }

      const screenStatus = systemPreferences.getMediaAccessStatus('screen')
      return screenStatus === 'granted'
    }
    return true
  })

  ipcMain.handle('audio:get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      fetchWindowIcons: true
    })
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }))
  })

  ipcMain.handle('audio:start-recording', async (_, source: 'microphone' | 'system' | 'both') => {
    if (!audioCapture) {
      audioCapture = new AudioCapture()
    }
    await audioCapture.startRecording(source, mainWindow)
    return true
  })

  ipcMain.handle('audio:stop-recording', async () => {
    if (!audioCapture) {
      throw new Error('No recording in progress')
    }
    const buffer = await audioCapture.stopRecording()
    return buffer
  })

  ipcMain.handle('audio:is-recording', () => {
    return audioCapture?.isRecording() ?? false
  })

  // ============================================
  // LLM
  // ============================================

  ipcMain.handle('llm:chat', async (_, modelId: string, messages: ChatMessage[]) => {
    const config = getModelConfig(modelId)
    if (!config) {
      throw new Error(`Model not found: ${modelId}`)
    }
    return callLLM(config, messages)
  })

  ipcMain.handle('llm:stream', async (event, modelId: string, messages: ChatMessage[]) => {
    const config = getModelConfig(modelId)
    if (!config) {
      throw new Error(`Model not found: ${modelId}`)
    }

    for await (const chunk of streamLLM(config, messages)) {
      event.sender.send('llm:stream-chunk', chunk)
    }
    event.sender.send('llm:stream-done')
  })

  ipcMain.handle('llm:get-models', () => {
    return defaultConfig.llmModels
  })

  ipcMain.handle('llm:test-connection', async (_, modelId: string) => {
    const config = getModelConfig(modelId)
    if (!config) {
      throw new Error(`Model not found: ${modelId}`)
    }

    try {
      const response = await callLLM(config, [{ role: 'user', content: 'Say "OK" and nothing else.' }])
      return { success: true, latencyMs: response.latencyMs }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ============================================
  // Database - Meetings
  // ============================================

  ipcMain.handle('db:get-meetings', async (_, options?: { limit?: number; offset?: number }) => {
    return db.getMeetings(options)
  })

  ipcMain.handle('db:get-meeting', async (_, id: string) => {
    return db.getMeetingById(id)
  })

  ipcMain.handle(
    'db:create-meeting',
    async (_, data: { title: string; templateId?: string; date?: Date }) => {
      return db.createMeeting(data)
    }
  )

  ipcMain.handle('db:update-meeting', async (_, id: string, data: Partial<db.MeetingUpdate>) => {
    return db.updateMeeting(id, data)
  })

  ipcMain.handle('db:delete-meeting', async (_, id: string) => {
    return db.deleteMeeting(id)
  })

  // ============================================
  // Database - Notes
  // ============================================

  ipcMain.handle('db:get-notes', async (_, meetingId: string) => {
    return db.getNotesByMeetingId(meetingId)
  })

  ipcMain.handle('db:save-notes', async (_, meetingId: string, rawNotes: string) => {
    return db.saveNotes(meetingId, rawNotes)
  })

  ipcMain.handle(
    'db:save-enhanced-notes',
    async (
      _,
      meetingId: string,
      enhancedNotes: string,
      llmModel: string,
      latencyMs: number
    ) => {
      return db.saveEnhancedNotes(meetingId, enhancedNotes, llmModel, latencyMs)
    }
  )

  // ============================================
  // Database - Transcripts
  // ============================================

  ipcMain.handle('db:get-transcript', async (_, meetingId: string) => {
    return db.getTranscriptByMeetingId(meetingId)
  })

  ipcMain.handle('db:save-transcript', async (_, meetingId: string, data: db.TranscriptData) => {
    return db.saveTranscript(meetingId, data)
  })

  // ============================================
  // Database - Evaluations
  // ============================================

  ipcMain.handle('db:save-evaluation', async (_, data: db.EvaluationData) => {
    return db.saveEvaluation(data)
  })

  ipcMain.handle('db:get-evaluations', async (_, options?: { modelId?: string; limit?: number }) => {
    return db.getEvaluations(options)
  })

  ipcMain.handle('db:get-evaluation-stats', async () => {
    return db.getEvaluationStats()
  })

  // ============================================
  // Transcription (Whisper Local)
  // ============================================

  ipcMain.handle('transcription:check-server', async () => {
    return checkWhisperServer()
  })

  ipcMain.handle('transcription:start', async (_, language: string = 'en') => {
    if (whisperService) {
      await whisperService.stop()
      whisperService = null
    }

    const service = new WhisperLocalService({ language })

    // Forward transcription events to renderer
    service.on('transcript', (result: { text: string }) => {
      console.log('Forwarding transcript to renderer:', result.text)
      mainWindow.webContents.send('transcription:result', result)
    })

    service.on('error', (error: Error) => {
      console.error('Transcription error:', error)
      mainWindow.webContents.send('transcription:error', error.message)
    })

    service.on('ready', () => {
      console.log('Transcription ready')
      mainWindow.webContents.send('transcription:ready')
    })

    console.log('Attempting to connect to Whisper server...')
    const connected = await service.connect()

    if (connected) {
      console.log('Successfully connected to Whisper server')
      whisperService = service
      return true
    } else {
      console.error('Failed to connect to Whisper server')
      service.disconnect()
      whisperService = null
      return false
    }
  })

  ipcMain.handle('transcription:send-audio', async (_, audioData: Uint8Array) => {
    if (!whisperService) {
      console.error('sendAudio called but whisperService is null')
      throw new Error('Transcription not started. Please check if Whisper server is running.')
    }
    if (!whisperService.getIsConnected()) {
      console.error('sendAudio called but whisperService is not connected')
      throw new Error('Transcription not connected. Please restart recording.')
    }
    // Convert Uint8Array to Buffer for Node.js APIs
    whisperService.sendAudio(Buffer.from(audioData))
  })

  ipcMain.handle('transcription:stop', async () => {
    if (whisperService) {
      await whisperService.stop()
      whisperService = null
    }
  })

  // ============================================
  // App State
  // ============================================

  ipcMain.on('recording-state-changed', (_, isRecording: boolean) => {
    mainWindow.webContents.send('recording-state', isRecording)
  })
}
