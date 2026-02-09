import { MessageSquare, Mic, User } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useMemo } from 'react'

interface TranscriptPanelProps {
  transcript: string
  isRecording: boolean
  onShowChat: () => void
}

// Colors for different speakers
const SPEAKER_COLORS = [
  'bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300',
  'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300',
  'bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300',
  'bg-orange-500/20 border-orange-500/50 text-orange-700 dark:text-orange-300',
  'bg-pink-500/20 border-pink-500/50 text-pink-700 dark:text-pink-300',
  'bg-cyan-500/20 border-cyan-500/50 text-cyan-700 dark:text-cyan-300',
]

interface TranscriptSegment {
  speaker: string | null
  text: string
  speakerIndex: number
}

function parseTranscript(transcript: string): TranscriptSegment[] {
  const lines = transcript.split('\n').filter((line) => line.trim())
  const speakerMap = new Map<string, number>()
  let speakerCount = 0

  return lines.map((line) => {
    // Match pattern like "SPEAKER_00: text" or "Speaker 1: text"
    const match = line.match(/^(SPEAKER_\d+|Speaker \d+):\s*(.*)$/i)

    if (match) {
      const speaker = match[1]
      const text = match[2]

      if (!speakerMap.has(speaker)) {
        speakerMap.set(speaker, speakerCount++)
      }

      return {
        speaker,
        text,
        speakerIndex: speakerMap.get(speaker) || 0
      }
    }

    // No speaker prefix - regular text
    return {
      speaker: null,
      text: line,
      speakerIndex: -1
    }
  })
}

function formatSpeakerName(speaker: string): string {
  // Convert "SPEAKER_00" to "Speaker 1"
  const match = speaker.match(/SPEAKER_(\d+)/i)
  if (match) {
    return `Speaker ${parseInt(match[1], 10) + 1}`
  }
  return speaker
}

export function TranscriptPanel({ transcript, isRecording, onShowChat }: TranscriptPanelProps) {
  const segments = useMemo(() => parseTranscript(transcript), [transcript])
  const hasSpeakers = segments.some((seg) => seg.speaker !== null)

  return (
    <div className="w-80 border-l border-border flex flex-col bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-medium">Transcript</h2>
        <button
          onClick={onShowChat}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="Chat with meeting"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isRecording && (
          <div className="flex items-center gap-2 mb-4 p-2 bg-red-500/10 text-red-500 rounded-lg text-sm">
            <Mic className="w-4 h-4 animate-pulse" />
            Recording in progress...
          </div>
        )}

        {transcript ? (
          <div className="space-y-3">
            {hasSpeakers ? (
              // Render with speaker labels
              segments.map((segment, index) => (
                <div key={index} className="text-sm">
                  {segment.speaker ? (
                    <div className="space-y-1">
                      <div
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                          SPEAKER_COLORS[segment.speakerIndex % SPEAKER_COLORS.length]
                        )}
                      >
                        <User className="w-3 h-3" />
                        {formatSpeakerName(segment.speaker)}
                      </div>
                      <p className="text-foreground pl-1">{segment.text}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{segment.text}</p>
                  )}
                </div>
              ))
            ) : (
              // Render without speaker labels (legacy format)
              transcript.split('\n\n').map((segment, index) => (
                <div key={index} className="text-sm">
                  <p className="text-muted-foreground">{segment}</p>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Mic className={cn('w-8 h-8 mx-auto mb-2', isRecording && 'text-red-500')} />
            <p className="text-sm">
              {isRecording
                ? 'Listening for speech...'
                : 'Start recording to see the transcript'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
