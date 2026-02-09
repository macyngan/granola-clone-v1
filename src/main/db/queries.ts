import { eq, desc, sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { getDb } from './index'
import { meetings, transcripts, notes, modelEvaluations } from './schema'
import type { TranscriptSegment, EvaluationTaskType } from '@shared/types'

// ============================================
// Meeting Queries
// ============================================

export interface MeetingUpdate {
  title?: string
  duration?: number
  templateId?: string
  status?: 'recording' | 'processing' | 'completed'
}

export async function getMeetings(options?: { limit?: number; offset?: number }) {
  const db = getDb()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  return db
    .select()
    .from(meetings)
    .orderBy(desc(meetings.date))
    .limit(limit)
    .offset(offset)
}

export async function getMeetingById(id: string) {
  const db = getDb()
  const result = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1)
  return result[0] ?? null
}

export async function createMeeting(data: { title: string; templateId?: string; date?: Date }) {
  const db = getDb()
  const id = uuid()
  const now = new Date()

  await db.insert(meetings).values({
    id,
    title: data.title,
    date: data.date ?? now,
    templateId: data.templateId,
    status: 'recording',
    createdAt: now,
    updatedAt: now
  })

  return getMeetingById(id)
}

export async function updateMeeting(id: string, data: Partial<MeetingUpdate>) {
  const db = getDb()
  const now = new Date()

  await db
    .update(meetings)
    .set({
      ...data,
      updatedAt: now
    })
    .where(eq(meetings.id, id))

  return getMeetingById(id)
}

export async function deleteMeeting(id: string) {
  const db = getDb()
  await db.delete(meetings).where(eq(meetings.id, id))
  return { success: true }
}

// ============================================
// Transcript Queries
// ============================================

export interface TranscriptData {
  fullText: string
  segments: TranscriptSegment[]
  sttModel: string
  language?: string
}

export async function getTranscriptByMeetingId(meetingId: string) {
  const db = getDb()
  const result = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.meetingId, meetingId))
    .limit(1)

  return result[0] ?? null
}

export async function saveTranscript(meetingId: string, data: TranscriptData) {
  const db = getDb()
  const id = uuid()
  const now = new Date()

  // Check if transcript exists
  const existing = await getTranscriptByMeetingId(meetingId)

  if (existing) {
    // Update existing
    await db
      .update(transcripts)
      .set({
        fullText: data.fullText,
        segments: JSON.stringify(data.segments),
        sttModel: data.sttModel,
        language: data.language ?? 'en'
      })
      .where(eq(transcripts.meetingId, meetingId))

    return getTranscriptByMeetingId(meetingId)
  }

  // Create new
  await db.insert(transcripts).values({
    id,
    meetingId,
    fullText: data.fullText,
    segments: JSON.stringify(data.segments),
    sttModel: data.sttModel,
    language: data.language ?? 'en',
    createdAt: now
  })

  return getTranscriptByMeetingId(meetingId)
}

// ============================================
// Notes Queries
// ============================================

export async function getNotesByMeetingId(meetingId: string) {
  const db = getDb()
  const result = await db
    .select()
    .from(notes)
    .where(eq(notes.meetingId, meetingId))
    .orderBy(desc(notes.version))
    .limit(1)

  return result[0] ?? null
}

export async function saveNotes(meetingId: string, rawNotes: string) {
  const db = getDb()
  const existing = await getNotesByMeetingId(meetingId)
  const now = new Date()

  if (existing) {
    // Update existing
    await db
      .update(notes)
      .set({
        rawNotes,
        updatedAt: now
      })
      .where(eq(notes.id, existing.id))

    return getNotesByMeetingId(meetingId)
  }

  // Create new
  const id = uuid()
  await db.insert(notes).values({
    id,
    meetingId,
    rawNotes,
    version: 1,
    createdAt: now,
    updatedAt: now
  })

  return getNotesByMeetingId(meetingId)
}

export async function saveEnhancedNotes(
  meetingId: string,
  enhancedNotes: string,
  llmModel: string,
  latencyMs: number
) {
  const db = getDb()
  const existing = await getNotesByMeetingId(meetingId)
  const now = new Date()

  if (existing) {
    await db
      .update(notes)
      .set({
        enhancedNotes,
        llmModel,
        enhancementLatencyMs: latencyMs,
        updatedAt: now
      })
      .where(eq(notes.id, existing.id))

    return getNotesByMeetingId(meetingId)
  }

  // Create new if doesn't exist
  const id = uuid()
  await db.insert(notes).values({
    id,
    meetingId,
    enhancedNotes,
    llmModel,
    enhancementLatencyMs: latencyMs,
    version: 1,
    createdAt: now,
    updatedAt: now
  })

  return getNotesByMeetingId(meetingId)
}

// ============================================
// Model Evaluation Queries
// ============================================

export interface EvaluationData {
  meetingId?: string
  taskType: EvaluationTaskType
  modelId: string
  modelName: string
  input: string
  output: string
  latencyMs?: number
  tokensUsed?: number
  userRating?: number
  notes?: string
}

export async function saveEvaluation(data: EvaluationData) {
  const db = getDb()
  const id = uuid()
  const now = new Date()

  await db.insert(modelEvaluations).values({
    id,
    meetingId: data.meetingId,
    taskType: data.taskType,
    modelId: data.modelId,
    modelName: data.modelName,
    input: data.input,
    output: data.output,
    latencyMs: data.latencyMs,
    tokensUsed: data.tokensUsed,
    userRating: data.userRating,
    notes: data.notes,
    createdAt: now
  })

  return { id }
}

export async function getEvaluations(options?: { modelId?: string; limit?: number }) {
  const db = getDb()
  const limit = options?.limit ?? 100

  let query = db.select().from(modelEvaluations).orderBy(desc(modelEvaluations.createdAt))

  if (options?.modelId) {
    query = query.where(eq(modelEvaluations.modelId, options.modelId)) as typeof query
  }

  return query.limit(limit)
}

export async function getEvaluationStats() {
  const db = getDb()

  const stats = await db
    .select({
      modelId: modelEvaluations.modelId,
      modelName: modelEvaluations.modelName,
      avgRating: sql<number>`avg(${modelEvaluations.userRating})`,
      avgLatency: sql<number>`avg(${modelEvaluations.latencyMs})`,
      avgTokens: sql<number>`avg(${modelEvaluations.tokensUsed})`,
      count: sql<number>`count(*)`
    })
    .from(modelEvaluations)
    .groupBy(modelEvaluations.modelId, modelEvaluations.modelName)
    .orderBy(desc(sql`avg(${modelEvaluations.userRating})`))

  return stats
}

export async function updateEvaluationRating(id: string, rating: number, evalNotes?: string) {
  const db = getDb()

  await db
    .update(modelEvaluations)
    .set({
      userRating: rating,
      notes: evalNotes
    })
    .where(eq(modelEvaluations.id, id))

  return { success: true }
}
