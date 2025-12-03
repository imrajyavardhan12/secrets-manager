import { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';
import { userInfo } from 'os';
import type { AuditAction, AuditLog, AuditLogRow } from '../types/index.js';

export class AuditLogger {
  private db: Database;
  private user: string;

  constructor(db: Database) {
    this.db = db;
    this.user = userInfo().username;
  }

  log(action: AuditAction, secretKey: string, environment: string, metadata?: Record<string, unknown>): void {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (id, timestamp, action, secret_key, environment, user, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      randomUUID(),
      Date.now(),
      action,
      secretKey,
      environment,
      this.user,
      metadata ? JSON.stringify(metadata) : null
    );
  }

  getLogs(options: {
    secretKey?: string;
    action?: AuditAction;
    limit?: number;
    offset?: number;
  } = {}): AuditLog[] {
    const { secretKey, action, limit = 50, offset = 0 } = options;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: (string | number)[] = [];

    if (secretKey) {
      query += ' AND secret_key = ?';
      params.push(secretKey);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as AuditLogRow[];

    return rows.map(row => this.rowToAuditLog(row));
  }

  getLogCount(secretKey?: string): number {
    let query = 'SELECT COUNT(*) as count FROM audit_logs';
    const params: string[] = [];

    if (secretKey) {
      query += ' WHERE secret_key = ?';
      params.push(secretKey);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  pruneLogs(keepLast: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM audit_logs WHERE id NOT IN (
        SELECT id FROM audit_logs ORDER BY timestamp DESC LIMIT ?
      )
    `);
    const result = stmt.run(keepLast);
    return result.changes;
  }

  exportLogs(secretKey?: string): AuditLog[] {
    return this.getLogs({ secretKey, limit: 100000 });
  }

  private rowToAuditLog(row: AuditLogRow): AuditLog {
    return {
      id: row.id,
      timestamp: row.timestamp,
      action: row.action as AuditAction,
      secret_key: row.secret_key,
      environment: row.environment,
      user: row.user,
      ip_address: row.ip_address ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }
}
