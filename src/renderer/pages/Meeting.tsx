import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic, MicOff, Sparkles, Loader2, AlertCircle, Monitor, Volume2 } from 'lucide-react'
import { NoteEditor } from '../components/meeting/NoteEditor'
import { TranscriptPanel } from '../components/meeting/TranscriptPanel'
import { TemplateSelector } from '../components/meeting/TemplateSelector'
import { MeetingChat } from '../components/meeting/MeetingChat'
import { useMeetingStore } from '../stores/meeting-store'
import { cn } from '../lib/utils'

export function MeetingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [title, setTitle] = useState('Untitled Meeting')
  const [selectedTemplate, setSelectedTemplate] = useState('general')
  const [rawNotes, setRawNotes] = useState('')
  const [enhancedNotes, setEnhancedNotes] = useState('')
  const [transcript, setTranscript] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [meetingId, setMeetingId] = useState<string | null>(id === 'new' ? null : id || null)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isStartingRecording, setIsStartingRecording] = useState(false)
  const [isStoppingRecording, setIsStoppingRecording] = useState(false)
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null)
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)
  const [audioSource, setAudioSource] = useState<'microphone' | 'system' | 'both'>('microphone')

  // Audio capture refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef<string>('')  // Track latest transcript for saving

  const { activeLLM } = useMeetingStore()

  // Check if Whisper server is running
  useEffect(() => {
    async function checkServer() {
      const available = await window.electron.transcription.checkServer()
      setWhisperAvailable(available)
    }
    checkServer()
  }, [])

  // Load existing meeting
  useEffect(() => {
    if (id && id !== 'new') {
      loadMeeting(id)
    }
  }, [id])

  // Listen for transcription results
  useEffect(() => {
    console.log('Setting up transcription result listener')
    const cleanupResult = window.electron.onTranscriptionResult((result) => {
      console.log('Received transcription result:', result)
      if (result.text) {
        // Server sends cumulative transcript, so replace instead of append
        setTranscript(result.text)
        transcriptRef.current = result.text  // Keep ref in sync for saving
      }
    })

    const cleanupError = window.electron.onTranscriptionError((error) => {
      console.error('Transcription error:', error)
      setTranscriptionError(error)
    })

    return () => {
      cleanupResult()
      cleanupError()
    }
  }, [])

  // Listen for toggle recording from tray/menu
  useEffect(() => {
    const cleanup = window.electron.onToggleRecording(() => {
      if (isRecording) {
        handleStopRecording()
      } else {
        handleStartRecording()
      }
    })
    return cleanup
  }, [isRecording])

  async function loadMeeting(meetingId: string) {
    try {
      const meeting = await window.electron.db.getMeeting(meetingId)
      if (meeting) {
        setTitle((meeting as { title: string }).title)
        setSelectedTemplate((meeting as { templateId?: string }).templateId || 'general')
      }

      const notes = await window.electron.db.getNotes(meetingId)
      if (notes) {
        setRawNotes((notes as { rawNotes?: string }).rawNotes || '')
        setEnhancedNotes((notes as { enhancedNotes?: string }).enhancedNotes || '')
      }

      const transcriptData = await window.electron.db.getTranscript(meetingId)
      if (transcriptData) {
        setTranscript((transcriptData as { fullText?: string }).fullText || '')
      }
    } catch (error) {
      console.error('Failed to load meeting:', error)
    }
  }

  async function createMeeting() {
    try {
      const meeting = await window.electron.db.createMeeting({
        title,
        templateId: selectedTemplate
      })
      const newId = (meeting as { id: string }).id
      setMeetingId(newId)
      navigate(`/meeting/${newId}`, { replace: true })
      return newId
    } catch (error) {
      console.error('Failed to create meeting:', error)
      return null
    }
  }

  async function handleStartRecording() {
    if (isStartingRecording) return // Prevent double-clicks

    try {
      setIsStartingRecording(true)
      setTranscriptionError(null)

      // Create meeting if new
      let currentMeetingId = meetingId
      if (!currentMeetingId) {
        currentMeetingId = await createMeeting()
        if (!currentMeetingId) return
      }

      // Start transcription if Whisper is available
      console.log('Whisper available:', whisperAvailable)
      if (whisperAvailable) {
        console.log('Connecting to Whisper server...')
        const connected = await window.electron.transcription.start('en')
        console.log('Whisper connected:', connected)
        if (!connected) {
          const errorMsg = 'Could not connect to Whisper server. Check that the server is running.'
          setTranscriptionError(errorMsg)
          setIsStartingRecording(false)
          return
        }
      }

      // Start audio capture based on selected source
      let stream: MediaStream

      if (audioSource === 'microphone') {
        // Microphone only
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
      } else if (audioSource === 'system') {
        // System audio only using ScreenCaptureKit (macOS 13+)
        // This triggers the display media handler in main process
        console.log('Requesting system audio via getDisplayMedia...')
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // Required but we'll discard it
            audio: true  // This will be system audio via loopback
          })
          console.log('Got display media stream, audio tracks:', stream.getAudioTracks().length)
        } catch (displayErr) {
          console.error('getDisplayMedia failed:', displayErr)
          throw new Error('System audio capture failed. Make sure Screen Recording permission is granted.')
        }
        // Remove video track, keep only audio
        stream.getVideoTracks().forEach((track) => track.stop())

        if (stream.getAudioTracks().length === 0) {
          throw new Error('System audio capture not available. Requires macOS 13+')
        }
        stream = new MediaStream(stream.getAudioTracks())
      } else {
        // Both: microphone + system audio
        console.log('Requesting both mic and system audio...')
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        console.log('Got mic stream, tracks:', micStream.getAudioTracks().length)

        let systemTracks: MediaStreamTrack[] = []
        try {
          console.log('Requesting system audio via getDisplayMedia...')
          const systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          })
          console.log('Got system stream, audio tracks:', systemStream.getAudioTracks().length)
          systemStream.getVideoTracks().forEach((track) => track.stop())
          systemTracks = systemStream.getAudioTracks()
        } catch (err) {
          console.warn('System audio not available, using mic only:', err)
          // Don't throw - just continue with mic only
        }

        stream = new MediaStream([...micStream.getAudioTracks(), ...systemTracks])
        console.log('Combined stream tracks:', stream.getAudioTracks().length)
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          console.log('Audio chunk received:', event.data.size, 'bytes')

          // Send to transcription if available
          if (whisperAvailable) {
            const arrayBuffer = await event.data.arrayBuffer()
            console.log('Sending audio to Whisper:', arrayBuffer.byteLength, 'bytes')
            try {
              await window.electron.transcription.sendAudio(new Uint8Array(arrayBuffer))
              console.log('Audio sent successfully')
            } catch (err) {
              console.error('Failed to send audio:', err)
            }
          }
        }
      }

      mediaRecorder.start(1000) // Collect data every second
      mediaRecorderRef.current = mediaRecorder

      setIsRecording(true)
      window.electron.setRecordingState(true)
    } catch (error) {
      console.error('Failed to start recording:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setTranscriptionError(errorMessage)
      // Also stop any partial recording state
      setIsRecording(false)
      window.electron.setRecordingState(false)
    } finally {
      setIsStartingRecording(false)
    }
  }

  async function handleStopRecording() {
    if (isStoppingRecording) return // Prevent double-clicks

    try {
      setIsStoppingRecording(true)

      // Stop transcription first to process any remaining audio
      if (whisperAvailable) {
        console.log('Sending stop signal to Whisper server...')
        await window.electron.transcription.stop()
        console.log('Transcription stopped')
      }

      // Now stop media recorder
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
        mediaRecorderRef.current = null
      }

      setIsRecording(false)
      window.electron.setRecordingState(false)

      // Save transcript to database
      if (meetingId && transcriptRef.current) {
        console.log('Saving transcript:', transcriptRef.current.slice(0, 100) + '...')
        await window.electron.db.saveTranscript(meetingId, {
          fullText: transcriptRef.current,
          segments: [],
          sttModel: 'whisper-local',
          language: 'en'
        })
      }

      // Update meeting status
      if (meetingId) {
        await window.electron.db.updateMeeting(meetingId, { status: 'processing' })
      }
    } catch (error) {
      console.error('Failed to stop recording:', error)
    } finally {
      setIsStoppingRecording(false)
    }
  }

  const handleNotesChange = useCallback(
    async (content: string) => {
      setRawNotes(content)

      // Debounced auto-save
      if (meetingId) {
        await window.electron.db.saveNotes(meetingId, content)
      }
    },
    [meetingId]
  )

  async function handleEnhanceNotes() {
    if (!rawNotes.trim() || !activeLLM) return

    setIsEnhancing(true)
    try {
      const response = await window.electron.llm.chat(activeLLM, [
        {
          role: 'system',
          content: `You are an expert meeting note enhancer. Take the raw notes and transcript provided and produce well-structured, comprehensive meeting notes. Include:
- A brief summary
- Key discussion points
- Decisions made
- Action items with owners if mentioned
- Next steps

Format the output in clean markdown.`
        },
        {
          role: 'user',
          content: `## Raw Notes\n${rawNotes}\n\n## Transcript\n${transcript || 'No transcript available'}`
        }
      ])

      setEnhancedNotes(response.content)

      if (meetingId) {
        await window.electron.db.saveEnhancedNotes(
          meetingId,
          response.content,
          activeLLM,
          response.latencyMs
        )
        await window.electron.db.updateMeeting(meetingId, { status: 'completed' })
      }
    } catch (error) {
      console.error('Failed to enhance notes:', error)
    } finally {
      setIsEnhancing(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 border-b border-border drag-region">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-accent rounded-lg transition-colors no-drag"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={async () => {
            if (meetingId) {
              await window.electron.db.updateMeeting(meetingId, { title })
            }
          }}
          className="flex-1 text-lg font-medium bg-transparent border-none outline-none no-drag"
          placeholder="Meeting title..."
        />

        <TemplateSelector value={selectedTemplate} onChange={setSelectedTemplate} />

        {/* Whisper status indicator */}
        {whisperAvailable === false && (
          <div className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/10 text-yellow-600 rounded no-drag">
            <AlertCircle className="w-3 h-3" />
            Whisper offline
          </div>
        )}

        {/* Audio source selector */}
        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={() => setAudioSource('microphone')}
            disabled={isRecording}
            className={cn(
              'p-2 rounded-l-lg transition-colors',
              audioSource === 'microphone'
                ? 'bg-primary text-primary-foreground'
                : 'bg-accent hover:bg-accent/80',
              isRecording && 'opacity-50 cursor-not-allowed'
            )}
            title="Microphone only"
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAudioSource('system')}
            disabled={isRecording}
            className={cn(
              'p-2 transition-colors',
              audioSource === 'system'
                ? 'bg-primary text-primary-foreground'
                : 'bg-accent hover:bg-accent/80',
              isRecording && 'opacity-50 cursor-not-allowed'
            )}
            title="System audio (Zoom, etc.) - macOS 13+"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAudioSource('both')}
            disabled={isRecording}
            className={cn(
              'p-2 rounded-r-lg transition-colors',
              audioSource === 'both'
                ? 'bg-primary text-primary-foreground'
                : 'bg-accent hover:bg-accent/80',
              isRecording && 'opacity-50 cursor-not-allowed'
            )}
            title="Microphone + System audio"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isStartingRecording || isStoppingRecording}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors no-drag',
            isRecording || isStoppingRecording
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
            (isStartingRecording || isStoppingRecording) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isStartingRecording ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting...
            </>
          ) : isStoppingRecording ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Stopping...
            </>
          ) : isRecording ? (
            <>
              <MicOff className="w-4 h-4" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Start Recording
            </>
          )}
        </button>
      </header>

      {/* Error banner */}
      {transcriptionError && (
        <div className="px-4 py-2 bg-red-500/10 text-red-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {transcriptionError}
          <button
            onClick={() => setTranscriptionError(null)}
            className="ml-auto text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Notes editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-medium">Notes</h2>
            <button
              onClick={handleEnhanceNotes}
              disabled={isEnhancing || !rawNotes.trim()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent hover:bg-accent/80 rounded-lg transition-colors disabled:opacity-50"
            >
              {isEnhancing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Enhance with AI
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {enhancedNotes ? (
              <div className="prose prose-sm max-w-none">
                <div className="mb-4 p-2 bg-accent/50 rounded text-sm text-muted-foreground">
                  Enhanced notes (AI-generated)
                </div>
                <div dangerouslySetInnerHTML={{ __html: enhancedNotes.replace(/\n/g, '<br>') }} />
              </div>
            ) : (
              <NoteEditor content={rawNotes} onChange={handleNotesChange} />
            )}
          </div>
        </div>

        {/* Transcript panel */}
        <TranscriptPanel
          transcript={transcript}
          isRecording={isRecording}
          onShowChat={() => setShowChat(true)}
        />

        {/* Chat panel */}
        {showChat && (
          <MeetingChat
            transcript={transcript}
            notes={rawNotes}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>
    </div>
  )
}
