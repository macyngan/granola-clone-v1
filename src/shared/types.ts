// ============================================
// Model Configuration Types
// ============================================

export type LLMProvider = 'ollama' | 'vllm' | 'openai-compatible' | 'anthropic' | 'groq'
export type STTProvider = 'whisper-cpp' | 'faster-whisper' | 'whisper-api' | 'deepgram' | 'assembly-ai'

export interface ModelConfig {
  id: string
  name: string
  provider: LLMProvider
  baseUrl: string
  apiKey?: string
  model: string
  maxTokens?: number
  temperature?: number
}

export interface STTConfig {
  id: string
  name: string
  provider: STTProvider
  modelPath?: string
  apiUrl?: string
  apiKey?: string
  language?: string
  options?: Record<string, unknown>
}

export interface AppConfig {
  activeSTT: string
  activeLLM: string
  sttModels: STTConfig[]
  llmModels: ModelConfig[]
}

// ============================================
// Chat/LLM Types
// ============================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  latencyMs: number
}

// ============================================
// Transcription Types
// ============================================

export interface TranscriptSegment {
  id: string
  text: string
  start: number // timestamp in seconds
  end: number
  speaker?: string // if diarization is available
  confidence: number
}

export interface TranscriptionResult {
  segments: TranscriptSegment[]
  fullText: string
  language: string
  duration: number
}

// ============================================
// Meeting Types
// ============================================

export type MeetingStatus = 'recording' | 'processing' | 'completed'

export interface Meeting {
  id: string
  title: string
  date: Date
  duration?: number // in seconds
  templateId?: string
  status: MeetingStatus
  createdAt: Date
  updatedAt: Date
}

export interface MeetingTranscript {
  id: string
  meetingId: string
  fullText: string
  segments: TranscriptSegment[]
  sttModel: string
  language: string
  createdAt: Date
}

export interface MeetingNotes {
  id: string
  meetingId: string
  rawNotes: string
  enhancedNotes?: string
  llmModel?: string
  enhancementLatencyMs?: number
  version: number
  createdAt: Date
  updatedAt: Date
}

// ============================================
// Template Types
// ============================================

export interface TemplateSection {
  name: string
  description: string
  required: boolean
  aiPrompt?: string
}

export interface NoteTemplate {
  id: string
  name: string
  description: string
  icon: string
  format: 'markdown' | 'structured'
  sections: TemplateSection[]
  customInstructions?: string
}

// ============================================
// Enhancement Types
// ============================================

export interface EnhancementResult {
  enhancedNotes: string
  summary: string
  actionItems: string[]
  keyTopics: string[]
  modelUsed: string
  latencyMs: number
}

// ============================================
// Calendar Types
// ============================================

export interface CalendarEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  isOnlineMeeting: boolean
  meetingUrl?: string
  attendees: string[]
}

// ============================================
// Evaluation Types (for model testing)
// ============================================

export type EvaluationTaskType = 'enhancement' | 'chat' | 'action_items' | 'summary'

export interface ModelEvaluation {
  id: string
  meetingId: string
  taskType: EvaluationTaskType
  modelId: string
  modelName: string
  input: string
  output: string
  latencyMs?: number
  tokensUsed?: number
  userRating?: number // 1-5
  notes?: string
  createdAt: Date
}

// ============================================
// IPC Types (for Electron communication)
// ============================================

export interface AudioSource {
  id: string
  name: string
  thumbnail?: string
}

export type AudioCaptureSource = 'microphone' | 'system' | 'both'
