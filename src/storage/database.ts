import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync, chmodSync } from 'fs';
import { dirname } from 'path';
import { SCHEMA_VERSION, FILE_PERMISSIONS } from '../utils/constants.js';

export function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true, mode: FILE_PERMISSIONS.VAULT_DIR });
  }
}

export function initializeDatabase(dbPath: string): Database {
  ensureDirectory(dirname(dbPath));

  const db = new Database(dbPath, { create: true });

  try {
    chmodSync(dbPath, FILE_PERMISSIONS.VAULT_DB);
  } catch {
    // Ignore permission errors on some systems
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      environment TEXT NOT NULL DEFAULT 'all',
      description TEXT,
      tags TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_used_at INTEGER,
      expires_at INTEGER,
      UNIQUE(key, environment)
    );

    CREATE INDEX IF NOT EXISTS idx_secrets_key ON secrets(key);
    CREATE INDEX IF NOT EXISTS idx_secrets_env ON secrets(environment);
    CREATE INDEX IF NOT EXISTS idx_secrets_updated ON secrets(updated_at);
    CREATE INDEX IF NOT EXISTS idx_secrets_expires ON secrets(expires_at);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_synced_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);

    CREATE TABLE IF NOT EXISTS project_secrets (
      project_id TEXT NOT NULL,
      secret_id TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (project_id, secret_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_project_secrets_project ON project_secrets(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_secrets_secret ON project_secrets(secret_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      action TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      environment TEXT NOT NULL,
      user TEXT NOT NULL,
      ip_address TEXT,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_secret ON audit_logs(secret_key);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
  `);

  db.exec('PRAGMA foreign_keys = ON;');

  return db;
}

export function setVaultMeta(db: Database, key: string, value: string): void {
  const stmt = db.prepare('INSERT OR REPLACE INTO vault_meta (key, value) VALUES (?, ?)');
  stmt.run(key, value);
}

export function getVaultMeta(db: Database, key: string): string | null {
  const stmt = db.prepare('SELECT value FROM vault_meta WHERE key = ?');
  const result = stmt.get(key) as { value: string } | null;
  return result?.value ?? null;
}

export function vaultExists(dbPath: string): boolean {
  return existsSync(dbPath);
}

export function getSchemaVersion(db: Database): string {
  return getVaultMeta(db, 'version') ?? SCHEMA_VERSION;
}
