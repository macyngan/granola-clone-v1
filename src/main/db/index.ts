import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import * as schema from './schema'

let db: ReturnType<typeof drizzle> | null = null
let sqlite: Database.Database | null = null

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export async function initDatabase(): Promise<void> {
  // Determine the database path
  const userDataPath = app.getPath('userData')
  const dataDir = join(userDataPath, 'data')

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  const dbPath = join(dataDir, 'app.db')
  console.log('Database path:', dbPath)

  // Create SQLite connection
  sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL') // Better performance

  // Create Drizzle instance
  db = drizzle(sqlite, { schema })

  // Run migrations
  try {
    // For now, we'll create tables directly since we haven't set up migrations
    // In production, you'd use: migrate(db, { migrationsFolder: './migrations' })
    createTables(sqlite)
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

function createTables(sqlite: Database.Database): void {
  // Create meetings table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date INTEGER NOT NULL,
      duration INTEGER,
      template_id TEXT,
      status TEXT DEFAULT 'recording' CHECK(status IN ('recording', 'processing', 'completed')),
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `)

  // Create transcripts table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      full_text TEXT,
      segments TEXT,
      stt_model TEXT,
      language TEXT DEFAULT 'en',
      created_at INTEGER DEFAULT (unixepoch())
    )
  `)

  // Create notes table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      raw_notes TEXT,
      enhanced_notes TEXT,
      llm_model TEXT,
      enhancement_latency_ms INTEGER,
      version INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `)

  // Create chat history table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      llm_model TEXT,
      latency_ms INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `)

  // Create model evaluations table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS model_evaluations (
      id TEXT PRIMARY KEY,
      meeting_id TEXT REFERENCES meetings(id) ON DELETE SET NULL,
      task_type TEXT NOT NULL CHECK(task_type IN ('enhancement', 'chat', 'action_items', 'summary')),
      model_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT NOT NULL,
      latency_ms INTEGER,
      tokens_used INTEGER,
      user_rating INTEGER CHECK(user_rating >= 1 AND user_rating <= 5),
      notes TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `)

  // Create indexes
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date DESC);
    CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON transcripts(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_notes_meeting ON notes(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_chat_meeting ON chat_history(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_evaluations_model ON model_evaluations(model_id);
  `)
}

export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
  }
}
