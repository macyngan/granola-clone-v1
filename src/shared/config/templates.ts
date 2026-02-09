import type { NoteTemplate } from '../types'

export const defaultTemplates: NoteTemplate[] = [
  {
    id: 'general',
    name: 'General Meeting',
    description: 'For any type of meeting',
    icon: '📝',
    format: 'markdown',
    sections: [
      { name: 'Summary', description: 'Brief overview of the meeting', required: true },
      { name: 'Key Discussion Points', description: 'Main topics discussed', required: true },
      { name: 'Decisions Made', description: 'Any decisions reached', required: false },
      { name: 'Action Items', description: 'Tasks with owners and deadlines', required: true },
      { name: 'Next Steps', description: 'Follow-up items', required: false }
    ]
  },
  {
    id: 'one-on-one',
    name: '1:1 Meeting',
    description: 'Manager/direct report check-ins',
    icon: '👥',
    format: 'markdown',
    sections: [
      { name: 'Check-in', description: 'How the person is doing', required: true },
      { name: 'Updates & Progress', description: 'What they have been working on', required: true },
      { name: 'Challenges', description: 'Blockers or difficulties', required: false },
      { name: 'Feedback', description: 'Feedback given or received', required: false },
      { name: 'Goals & Action Items', description: 'Agreed next steps', required: true }
    ]
  },
  {
    id: 'customer-discovery',
    name: 'Customer Discovery',
    description: 'User research and customer interviews',
    icon: '🔍',
    format: 'structured',
    sections: [
      { name: 'Customer Profile', description: 'Who they are, their role, company', required: true },
      { name: 'Current Workflow', description: 'How they currently solve the problem', required: true },
      { name: 'Pain Points', description: 'Frustrations and challenges', required: true },
      { name: 'Feature Requests', description: 'What they wish existed', required: false },
      { name: 'Quotes', description: 'Notable verbatim quotes', required: false },
      { name: 'Insights', description: 'Key takeaways for product', required: true }
    ],
    customInstructions:
      'Focus on extracting specific pain points with examples. Capture exact quotes when the customer expresses strong emotions or opinions.'
  },
  {
    id: 'sales',
    name: 'Sales Call',
    description: 'Sales meetings and demos',
    icon: '💼',
    format: 'structured',
    sections: [
      { name: 'Prospect Info', description: 'Company, role, team size', required: true },
      { name: 'Current Solution', description: 'What they use today', required: true },
      { name: 'Requirements', description: 'What they need', required: true },
      { name: 'Budget & Timeline', description: 'Budget range and decision timeline', required: false },
      { name: 'Objections', description: 'Concerns raised', required: false },
      { name: 'Next Steps', description: 'Follow-up actions', required: true },
      { name: 'Deal Score', description: 'Likelihood to close (1-10)', required: false }
    ]
  },
  {
    id: 'standup',
    name: 'Standup',
    description: 'Daily/weekly standups',
    icon: '🚀',
    format: 'structured',
    sections: [
      { name: 'Yesterday/Last Week', description: 'What was accomplished', required: true },
      { name: 'Today/This Week', description: 'What is planned', required: true },
      { name: 'Blockers', description: 'What is in the way', required: true }
    ]
  },
  {
    id: 'pitch',
    name: 'Pitch/Presentation',
    description: 'Investor pitches, board meetings',
    icon: '📊',
    format: 'markdown',
    sections: [
      { name: 'Attendees', description: 'Who was present', required: true },
      { name: 'Presentation Summary', description: 'Main points presented', required: true },
      { name: 'Questions Asked', description: 'Questions from audience', required: true },
      { name: 'Feedback Received', description: 'Comments and reactions', required: false },
      { name: 'Follow-ups', description: 'Materials to send, meetings to schedule', required: true }
    ]
  }
]

// Helper to get a template by ID
export function getTemplate(templateId: string): NoteTemplate | undefined {
  return defaultTemplates.find((t) => t.id === templateId)
}

// Helper to get default template
export function getDefaultTemplate(): NoteTemplate {
  return defaultTemplates[0]
}
