import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { useMeetingStore } from '../../stores/meeting-store'
import { cn } from '../../lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface MeetingChatProps {
  transcript: string
  notes: string
  onClose: () => void
}

const quickActions = [
  { label: 'Summarize', prompt: 'Give me a brief summary of this meeting.' },
  { label: 'Action Items', prompt: 'List all action items mentioned in this meeting.' },
  { label: 'Decisions', prompt: 'What decisions were made in this meeting?' },
  { label: 'Follow-up Email', prompt: 'Draft a follow-up email summarizing this meeting.' }
]

export function MeetingChat({ transcript, notes, onClose }: MeetingChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { activeLLM } = useMeetingStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(content: string) {
    if (!content.trim() || !activeLLM) return

    const userMessage: Message = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const systemPrompt = `You are an AI assistant helping with meeting notes.
You have access to the transcript and notes from a meeting.

## Meeting Transcript
${transcript || 'No transcript available'}

## Meeting Notes
${notes || 'No notes available'}

Answer questions about this meeting accurately and concisely.
If something wasn't discussed in the meeting, say so.`

      const response = await window.electron.llm.chat(activeLLM, [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content }
      ])

      setMessages((prev) => [...prev, { role: 'assistant', content: response.content }])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-96 border-l border-border flex flex-col bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-medium">Chat with Meeting</h2>
        <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick actions */}
      {messages.length === 0 && (
        <div className="p-4 border-b border-border">
          <p className="text-sm text-muted-foreground mb-2">Quick actions:</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                className="px-3 py-1 text-sm bg-accent hover:bg-accent/80 rounded-full transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              'max-w-[85%] rounded-lg p-3 text-sm',
              message.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'bg-accent'
            )}
          >
            {message.content}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage(input)
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this meeting..."
            className="flex-1 px-3 py-2 text-sm bg-accent border-none rounded-lg outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
