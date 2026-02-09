import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileText, Clock, Trash2 } from 'lucide-react'
import { formatDate, formatRelativeTime, formatDuration } from '../lib/utils'
import { cn } from '../lib/utils'

interface Meeting {
  id: string
  title: string
  date: number
  duration?: number
  status: 'recording' | 'processing' | 'completed'
  templateId?: string
}

export function HomePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMeetings()
  }, [])

  async function loadMeetings() {
    try {
      const data = await window.electron.db.getMeetings({ limit: 50 })
      setMeetings(data as Meeting[])
    } catch (error) {
      console.error('Failed to load meetings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this meeting?')) return

    try {
      await window.electron.db.deleteMeeting(id)
      setMeetings((prev) => prev.filter((m) => m.id !== id))
    } catch (error) {
      console.error('Failed to delete meeting:', error)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Meetings</h1>
          <p className="text-muted-foreground">Your recent meeting notes</p>
        </div>
        <Link
          to="/meeting/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Meeting
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium mb-2">No meetings yet</h2>
          <p className="text-muted-foreground mb-4">
            Start your first meeting to begin taking notes
          </p>
          <Link
            to="/meeting/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Meeting
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="flex items-center gap-4 p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors group"
            >
              <Link to={`/meeting/${meeting.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      meeting.status === 'recording' && 'bg-red-500 animate-pulse-recording',
                      meeting.status === 'processing' && 'bg-yellow-500',
                      meeting.status === 'completed' && 'bg-green-500'
                    )}
                  />
                  <h3 className="font-medium truncate">{meeting.title}</h3>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span>{formatDate(meeting.date)}</span>
                  {meeting.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(meeting.duration)}
                    </span>
                  )}
                  <span>{formatRelativeTime(meeting.date)}</span>
                </div>
              </Link>
              <button
                onClick={() => handleDelete(meeting.id)}
                className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete meeting"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
