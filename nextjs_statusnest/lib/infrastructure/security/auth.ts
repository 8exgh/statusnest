import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { User, Session } from '@/types';
import { getSystemDatabase } from '@/lib/infrastructure/database/connection';

const SALT_ROUNDS = 10;
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createUser(email: string, password: string): Promise<User> {
  const db = getSystemDatabase();
  
  const userId = randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(password);
  
  const stmt = db.prepare(`
    INSERT INTO users (id, email, password_hash, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  const now = new Date();
  stmt.run(userId, email.toLowerCase(), passwordHash, now.toISOString());
  
  db.close();
  
  return {
    id: userId,
    email: email.toLowerCase(),
    createdAt: now
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getSystemDatabase();
  
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const row = stmt.get(email.toLowerCase()) as any;
  
  db.close();
  
  if (!row) {
    return null;
  }
  
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: new Date(row.created_at)
  };
}

export async function createSession(userId: string): Promise<{ session: Session; token: string }> {
  const db = getSystemDatabase();
  
  const sessionId = randomBytes(16).toString('hex');
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const createdAt = new Date();
  
  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    sessionId,
    userId,
    tokenHash,
    expiresAt.toISOString(),
    createdAt.toISOString()
  );
  
  db.close();
  
  return {
    session: {
      id: sessionId,
      userId,
      tokenHash,
      expiresAt,
      createdAt
    },
    token
  };
}

export async function validateSession(token: string): Promise<User | null> {
  const db = getSystemDatabase();
  
  const tokenHash = hashToken(token);
  
  const stmt = db.prepare(`
    SELECT s.*, u.* 
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `);
  
  const row = stmt.get(tokenHash, new Date().toISOString()) as any;
  
  db.close();
  
  if (!row) {
    return null;
  }
  
  return {
    id: row.user_id,
    email: row.email,
    createdAt: new Date(row.created_at)
  };
}

export async function invalidateSession(token: string): Promise<void> {
  const db = getSystemDatabase();
  
  const tokenHash = hashToken(token);
  
  const stmt = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  stmt.run(tokenHash);
  
  db.close();
}

export function getSessionFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  const cookie = request.headers.get('cookie');
  if (cookie) {
    const match = cookie.match(/session=([^;]+)/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}