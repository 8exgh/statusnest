import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const DATA_PATH = process.env.DATABASE_PATH || './data';

export function ensureDirectoryExists(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getSystemDatabase(): Database.Database {
  const dbPath = join(DATA_PATH, 'system', 'system.db');
  ensureDirectoryExists(dbPath);
  
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_session_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_session_expiry ON sessions(expires_at);
  `);
  
  return db;
}

export function getUserWriteDatabase(userId: string): Database.Database {
  const dbPath = join(DATA_PATH, 'users', userId, 'write.db');
  ensureDirectoryExists(dbPath);
  
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aggregate_id TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_version INTEGER NOT NULL,
      event_data JSON NOT NULL,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sequence_number INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_aggregate ON events(aggregate_id, aggregate_type);
    CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_sequence ON events(sequence_number);
  `);
  
  return db;
}

export function getReadModelDatabase(): Database.Database {
  const dbPath = join(DATA_PATH, 'read_model', 'read.db');
  ensureDirectoryExists(dbPath);
  
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS domain_monitors (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT CHECK(status IN ('online', 'offline', 'unknown')),
      active INTEGER DEFAULT 1,
      last_checked_at TIMESTAMP,
      next_check_at TIMESTAMP,
      response_code INTEGER,
      response_time_ms INTEGER,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_domain ON domain_monitors(domain);
    CREATE INDEX IF NOT EXISTS idx_user ON domain_monitors(user_id);
    CREATE INDEX IF NOT EXISTS idx_next_check ON domain_monitors(next_check_at);
    CREATE INDEX IF NOT EXISTS idx_active ON domain_monitors(active);
    
    CREATE TABLE IF NOT EXISTS projection_checkpoints (
      user_id TEXT PRIMARY KEY,
      last_processed_sequence INTEGER NOT NULL,
      last_processed_at TIMESTAMP
    );
  `);
  
  return db;
}

export function getAllUserIds(): string[] {
  const usersPath = join(DATA_PATH, 'users');
  if (!existsSync(usersPath)) {
    return [];
  }
  
  const { readdirSync, statSync } = require('fs');
  const entries = readdirSync(usersPath);
  
  return entries.filter((entry: string) => {
    const fullPath = join(usersPath, entry);
    return statSync(fullPath).isDirectory();
  });
}