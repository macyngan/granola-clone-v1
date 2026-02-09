import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const meetings = sqliteTable('meetings', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  duration: integer('duration'),
  templateId: text('template_id'),
  status: text('status', { enum: ['recording', 'processing', 'completed'] }).default('recording'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
})

export const transcripts = sqliteTable('transcripts', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id')
    .notNull()
    .references(() => meetings.id),
  fullText: text('full_text'),
  segments: text('segments', { mode: 'json' }),
  sttModel: text('stt_model'),
  language: text('language').default('en'),
  createdAt: integer('created_at', { mode: 'timestamp' })
})

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id')
    .notNull()
    .references(() => meetings.id),
  rawNotes: text('raw_notes'),
  enhancedNotes: text('enhanced_notes'),
  llmModel: text('llm_model'),
  enhancementLatencyMs: integer('enhancement_latency_ms'),
  version: integer('version').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
})

export const chatHistory = sqliteTable('chat_history', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id')
    .notNull()
    .references(() => meetings.id),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  llmModel: text('llm_model'),
  latencyMs: integer('latency_ms'),
  createdAt: integer('created_at', { mode: 'timestamp' })
})

export const modelEvaluations = sqliteTable('model_evaluations', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id').references(() => meetings.id),
  taskType: text('task_type', {
    enum: ['enhancement', 'chat', 'action_items', 'summary']
  }).notNull(),
  modelId: text('model_id').notNull(),
  modelName: text('model_name').notNull(),
  input: text('input').notNull(),
  output: text('output').notNull(),
  latencyMs: integer('latency_ms'),
  tokensUsed: integer('tokens_used'),
  userRating: integer('user_rating'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' })
})

// Type exports for use in queries
export type Meeting = typeof meetings.$inferSelect
export type NewMeeting = typeof meetings.$inferInsert
export type Transcript = typeof transcripts.$inferSelect
export type NewTranscript = typeof transcripts.$inferInsert
export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
export type ChatMessage = typeof chatHistory.$inferSelect
export type NewChatMessage = typeof chatHistory.$inferInsert
export type ModelEvaluation = typeof modelEvaluations.$inferSelect
export type NewModelEvaluation = typeof modelEvaluations.$inferInsert
