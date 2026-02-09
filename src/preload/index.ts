import { contextBridge, ipcRenderer } from 'electron'
import type { ChatMessage, AudioSource, ModelConfig } from '@shared/types'
import type { MeetingUpdate, TranscriptData, EvaluationData } from '@main/db/queries'

// Type definitions for the exposed API
export interface ElectronAPI {
  audio: {
    requestPermissions: () => Promise<boolean>
    getSources: () => Promise<AudioSource[]>
    startRecording: (source: 'microphone' | 'system' | 'both') => Promise<boolean>
    stopRecording: () => Promise<Buffer>
    isRecording: () => Promise<boolean>
  }
  onAudioChunk: (callback: (chunk: Buffer) => void) => () => void
  onStartCapture: (callback: (source: string) => void) => () => void
  onStopCapture: (callback: () => void) => () => void
  sendCaptureComplete: (buffer: Buffer) => void
  sendCaptureError: (error: string) => void

  llm: {
    chat: (modelId: string, messages: ChatMessage[]) => Promise<import('@shared/types').LLMResponse>
    stream: (modelId: string, messages: ChatMessage[], onChunk: (chunk: string) => void) => () => void
    getModels: () => Promise<ModelConfig[]>
    testConnection: (modelId: string) => Promise<{ success: boolean; latencyMs?: number; error?: string }>
  }

  db: {
    getMeetings: (options?: { limit?: number; offset?: number }) => Promise<unknown[]>
    getMeeting: (id: string) => Promise<unknown | null>
    createMeeting: (data: { title: string; templateId?: string; date?: Date }) => Promise<unknown>
    updateMeeting: (id: string, data: Partial<MeetingUpdate>) => Promise<unknown>
    deleteMeeting: (id: string) => Promise<{ success: boolean }>
    getNotes: (meetingId: string) => Promise<unknown | null>
    saveNotes: (meetingId: string, rawNotes: string) => Promise<unknown>
    saveEnhancedNotes: (meetingId: string, enhancedNotes: string, llmModel: string, latencyMs: number) => Promise<unknown>
    getTranscript: (meetingId: string) => Promise<unknown | null>
    saveTranscript: (meetingId: string, data: TranscriptData) => Promise<unknown>
    saveEvaluation: (data: EvaluationData) => Promise<{ id: string }>
    getEvaluations: (options?: { modelId?: string; limit?: number }) => Promise<unknown[]>
    getEvaluationStats: () => Promise<unknown[]>
  }

  transcription: {
    checkServer: () => Promise<boolean>
    start: (language?: string) => Promise<boolean>
    sendAudio: (audioData: Uint8Array) => Promise<void>
    stop: () => Promise<void>
  }
  onTranscriptionResult: (callback: (result: { text: string }) => void) => () => void
  onTranscriptionReady: (callback: () => void) => () => void
  onTranscriptionError: (callback: (error: string) => void) => () => void

  onNavigate: (callback: (path: string) => void) => () => void
  onToggleRecording: (callback: () => void) => () => void
  onRecordingState: (callback: (isRecording: boolean) => void) => () => void
  setRecordingState: (isRecording: boolean) => void
}

const api: ElectronAPI = {
  // Audio capture
  audio: {
    requestPermissions: () => ipcRenderer.invoke('audio:request-permissions'),
    getSources: () => ipcRenderer.invoke('audio:get-sources'),
    startRecording: (source) => ipcRenderer.invoke('audio:start-recording', source),
    stopRecording: () => ipcRenderer.invoke('audio:stop-recording'),
    isRecording: () => ipcRenderer.invoke('audio:is-recording')
  },

  // Real-time audio chunks from main process
  onAudioChunk: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, chunk: Buffer) => callback(chunk)
    ipcRenderer.on('audio:chunk', handler)
    return () => ipcRenderer.removeListener('audio:chunk', handler)
  },

  // Audio capture coordination with main process
  onStartCapture: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, source: string) => callback(source)
    ipcRenderer.on('audio:start-capture', handler)
    return () => ipcRenderer.removeListener('audio:start-capture', handler)
  },

  onStopCapture: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('audio:stop-capture', handler)
    return () => ipcRenderer.removeListener('audio:stop-capture', handler)
  },

  sendCaptureComplete: (buffer) => {
    ipcRenderer.send('audio:capture-complete', buffer)
  },

  sendCaptureError: (error) => {
    ipcRenderer.send('audio:capture-error', error)
  },

  // LLM
  llm: {
    chat: (modelId, messages) => ipcRenderer.invoke('llm:chat', modelId, messages),
    stream: (modelId, messages, onChunk) => {
      const chunkHandler = (_: Electron.IpcRendererEvent, chunk: string) => onChunk(chunk)
      const doneHandler = () => {
        ipcRenderer.removeListener('llm:stream-chunk', chunkHandler)
        ipcRenderer.removeListener('llm:stream-done', doneHandler)
      }

      ipcRenderer.on('llm:stream-chunk', chunkHandler)
      ipcRenderer.on('llm:stream-done', doneHandler)
      ipcRenderer.invoke('llm:stream', modelId, messages)

      return () => {
        ipcRenderer.removeListener('llm:stream-chunk', chunkHandler)
        ipcRenderer.removeListener('llm:stream-done', doneHandler)
      }
    },
    getModels: () => ipcRenderer.invoke('llm:get-models'),
    testConnection: (modelId) => ipcRenderer.invoke('llm:test-connection', modelId)
  },

  // Database
  db: {
    getMeetings: (options) => ipcRenderer.invoke('db:get-meetings', options),
    getMeeting: (id) => ipcRenderer.invoke('db:get-meeting', id),
    createMeeting: (data) => ipcRenderer.invoke('db:create-meeting', data),
    updateMeeting: (id, data) => ipcRenderer.invoke('db:update-meeting', id, data),
    deleteMeeting: (id) => ipcRenderer.invoke('db:delete-meeting', id),
    getNotes: (meetingId) => ipcRenderer.invoke('db:get-notes', meetingId),
    saveNotes: (meetingId, rawNotes) => ipcRenderer.invoke('db:save-notes', meetingId, rawNotes),
    saveEnhancedNotes: (meetingId, enhancedNotes, llmModel, latencyMs) =>
      ipcRenderer.invoke('db:save-enhanced-notes', meetingId, enhancedNotes, llmModel, latencyMs),
    getTranscript: (meetingId) => ipcRenderer.invoke('db:get-transcript', meetingId),
    saveTranscript: (meetingId, data) => ipcRenderer.invoke('db:save-transcript', meetingId, data),
    saveEvaluation: (data) => ipcRenderer.invoke('db:save-evaluation', data),
    getEvaluations: (options) => ipcRenderer.invoke('db:get-evaluations', options),
    getEvaluationStats: () => ipcRenderer.invoke('db:get-evaluation-stats')
  },

  // Transcription (Whisper Local)
  transcription: {
    checkServer: () => ipcRenderer.invoke('transcription:check-server'),
    start: (language = 'en') => ipcRenderer.invoke('transcription:start', language),
    sendAudio: (audioData) => ipcRenderer.invoke('transcription:send-audio', audioData),
    stop: () => ipcRenderer.invoke('transcription:stop')
  },

  onTranscriptionResult: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, result: { text: string }) =>
      callback(result)
    ipcRenderer.on('transcription:result', handler)
    return () => ipcRenderer.removeListener('transcription:result', handler)
  },

  onTranscriptionReady: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('transcription:ready', handler)
    return () => ipcRenderer.removeListener('transcription:ready', handler)
  },

  onTranscriptionError: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on('transcription:error', handler)
    return () => ipcRenderer.removeListener('transcription:error', handler)
  },

  // App events
  onNavigate: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, path: string) => callback(path)
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.removeListener('navigate', handler)
  },

  onToggleRecording: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('tray:toggle-recording', handler)
    return () => ipcRenderer.removeListener('tray:toggle-recording', handler)
  },

  onRecordingState: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, isRecording: boolean) => callback(isRecording)
    ipcRenderer.on('recording-state', handler)
    return () => ipcRenderer.removeListener('recording-state', handler)
  },

  setRecordingState: (isRecording) => {
    ipcRenderer.send('recording-state-changed', isRecording)
  }
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', api)

// TypeScript declarations for the renderer
declare global {
  interface Window {
    electron: ElectronAPI
  }
}
