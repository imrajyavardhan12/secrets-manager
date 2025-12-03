import { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';
import type { Secret, SecretRow, Environment, VaultState, RuntimeState } from '../types/index.js';
import { CryptoManager } from './crypto.js';
import { AuditLogger } from './audit.js';
import {
  initializeDatabase,
  setVaultMeta,
  getVaultMeta,
  vaultExists
} from '../storage/database.js';
import {
  VaultNotInitializedError,
  VaultLockedError,
  VaultAlreadyInitializedError,
  WrongPasswordError,
  LockedOutError,
  SecretNotFoundError,
  SecretAlreadyExistsError,
  SecretValueTooLargeError
} from '../utils/errors.js';
import {
  VAULT_DB_PATH,
  SCHEMA_VERSION,
  DEFAULT_AUTO_LOCK_TIMEOUT,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  MAX_SECRET_VALUE_SIZE
} from '../utils/constants.js';

const PASSWORD_VERIFICATION_KEY = '__vault_verification__';
const PASSWORD_VERIFICATION_VALUE = 'secrets-manager-v1';

export class VaultManager {
  private db: Database | null = null;
  private cryptoManager: CryptoManager | null = null;
  private auditLogger: AuditLogger | null = null;
  private dbPath: string;
  private state: RuntimeState = {
    masterKey: null,
    vaultState: 'not_initialized' as VaultState,
    lastActivity: new Date(),
    autoLockTimer: null,
    failedAttempts: 0,
    lockoutUntil: null
  };
  private autoLockTimeout: number = DEFAULT_AUTO_LOCK_TIMEOUT * 60 * 1000;

  constructor(dbPath: string = VAULT_DB_PATH) {
    this.dbPath = dbPath;
    this.checkInitialization();
  }

  private checkInitialization(): void {
    if (vaultExists(this.dbPath)) {
      this.state.vaultState = 'locked' as VaultState;
    } else {
      this.state.vaultState = 'not_initialized' as VaultState;
    }
  }

  isInitialized(): boolean {
    return vaultExists(this.dbPath);
  }

  isLocked(): boolean {
    return this.cryptoManager === null;
  }

  getState(): VaultState {
    return this.state.vaultState as VaultState;
  }

  initialize(password: string, options: { force?: boolean; timeout?: number } = {}): void {
    if (this.isInitialized() && !options.force) {
      throw new VaultAlreadyInitializedError();
    }

    const salt = CryptoManager.generateSalt();
    this.db = initializeDatabase(this.dbPath);
    this.cryptoManager = new CryptoManager(password, salt);
    this.auditLogger = new AuditLogger(this.db);

    setVaultMeta(this.db, 'salt', Buffer.from(salt).toString('base64'));
    setVaultMeta(this.db, 'version', SCHEMA_VERSION);
    setVaultMeta(this.db, 'created_at', Date.now().toString());
    setVaultMeta(this.db, 'auto_lock_timeout', (options.timeout ?? DEFAULT_AUTO_LOCK_TIMEOUT).toString());

    const verificationEncrypted = this.cryptoManager.encrypt(PASSWORD_VERIFICATION_VALUE);
    setVaultMeta(this.db, PASSWORD_VERIFICATION_KEY, verificationEncrypted);

    this.state.vaultState = 'unlocked' as VaultState;
    this.autoLockTimeout = (options.timeout ?? DEFAULT_AUTO_LOCK_TIMEOUT) * 60 * 1000;
    this.startAutoLockTimer();
  }

  unlock(password: string, options: { timeout?: number } = {}): boolean {
    if (!this.isInitialized()) {
      throw new VaultNotInitializedError();
    }

    this.db = new Database(this.dbPath);

    this.loadLockoutState();

    if (this.state.lockoutUntil && Date.now() < this.state.lockoutUntil.getTime()) {
      const remainingSeconds = Math.ceil((this.state.lockoutUntil.getTime() - Date.now()) / 1000);
      this.db.close();
      this.db = null;
      throw new LockedOutError(remainingSeconds);
    }

    if (this.state.lockoutUntil && Date.now() >= this.state.lockoutUntil.getTime()) {
      this.state.failedAttempts = 0;
      this.state.lockoutUntil = null;
      this.clearLockoutState();
    }

    const saltBase64 = getVaultMeta(this.db, 'salt');
    
    if (!saltBase64) {
      throw new VaultNotInitializedError();
    }

    const salt = new Uint8Array(Buffer.from(saltBase64, 'base64'));
    const testCrypto = new CryptoManager(password, salt);

    const verificationEncrypted = getVaultMeta(this.db, PASSWORD_VERIFICATION_KEY);
    if (!verificationEncrypted || !testCrypto.verifyPassword(PASSWORD_VERIFICATION_VALUE, verificationEncrypted)) {
      this.state.failedAttempts++;

      if (this.state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        this.state.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        this.state.vaultState = 'locked_out' as VaultState;
        this.persistLockoutState();
        this.db.close();
        this.db = null;
        throw new LockedOutError(Math.ceil(LOCKOUT_DURATION_MS / 1000));
      }

      this.persistLockoutState();
      this.db.close();
      this.db = null;
      throw new WrongPasswordError(MAX_FAILED_ATTEMPTS - this.state.failedAttempts);
    }

    this.state.failedAttempts = 0;
    this.state.lockoutUntil = null;
    this.clearLockoutState();
    this.cryptoManager = testCrypto;
    this.auditLogger = new AuditLogger(this.db);
    this.state.vaultState = 'unlocked' as VaultState;

    const timeoutStr = getVaultMeta(this.db, 'auto_lock_timeout');
    this.autoLockTimeout = (options.timeout ?? parseInt(timeoutStr ?? String(DEFAULT_AUTO_LOCK_TIMEOUT))) * 60 * 1000;
    this.startAutoLockTimer();

    return true;
  }

  private loadLockoutState(): void {
    if (!this.db) return;
    const attempts = getVaultMeta(this.db, 'failed_attempts');
    const lockoutUntil = getVaultMeta(this.db, 'lockout_until');
    if (attempts) {
      this.state.failedAttempts = parseInt(attempts, 10);
    }
    if (lockoutUntil && lockoutUntil !== '') {
      this.state.lockoutUntil = new Date(parseInt(lockoutUntil, 10));
    }
  }

  private persistLockoutState(): void {
    if (!this.db) return;
    setVaultMeta(this.db, 'failed_attempts', this.state.failedAttempts.toString());
    setVaultMeta(this.db, 'lockout_until', this.state.lockoutUntil?.getTime().toString() ?? '');
  }

  private clearLockoutState(): void {
    if (!this.db) return;
    setVaultMeta(this.db, 'failed_attempts', '0');
    setVaultMeta(this.db, 'lockout_until', '');
  }

  lock(): void {
    this.clearAutoLockTimer();

    if (this.cryptoManager) {
      this.cryptoManager.clearMasterKey();
      this.cryptoManager = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.auditLogger = null;
    this.state.vaultState = 'locked' as VaultState;
  }

  private ensureUnlocked(): void {
    if (this.isLocked()) {
      throw new VaultLockedError();
    }
    this.touchActivity();
  }

  private touchActivity(): void {
    this.state.lastActivity = new Date();
    this.resetAutoLockTimer();
  }

  private startAutoLockTimer(): void {
    this.clearAutoLockTimer();
    this.state.autoLockTimer = setTimeout(() => {
      this.lock();
    }, this.autoLockTimeout);
  }

  private resetAutoLockTimer(): void {
    if (!this.isLocked()) {
      this.startAutoLockTimer();
    }
  }

  private clearAutoLockTimer(): void {
    if (this.state.autoLockTimer) {
      clearTimeout(this.state.autoLockTimer);
      this.state.autoLockTimer = null;
    }
  }

  addSecret(
    key: string,
    value: string,
    environment: Environment = 'all',
    options: { description?: string; tags?: string[]; expiresAt?: number } = {}
  ): Secret {
    this.ensureUnlocked();

    if (Buffer.byteLength(value, 'utf8') > MAX_SECRET_VALUE_SIZE) {
      throw new SecretValueTooLargeError(MAX_SECRET_VALUE_SIZE);
    }

    const existing = this.getSecretRaw(key, environment);
    if (existing) {
      throw new SecretAlreadyExistsError(key, environment);
    }

    const encryptedValue = this.cryptoManager!.encrypt(value);
    const now = Date.now();
    const id = randomUUID();

    const stmt = this.db!.prepare(`
      INSERT INTO secrets (id, key, value, environment, description, tags, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      key,
      encryptedValue,
      environment,
      options.description ?? null,
      options.tags ? JSON.stringify(options.tags) : null,
      now,
      now,
      options.expiresAt ?? null
    );

    this.auditLogger!.log('write', key, environment);

    return {
      id,
      key,
      value: encryptedValue,
      environment,
      description: options.description,
      tags: options.tags,
      created_at: now,
      updated_at: now,
      expires_at: options.expiresAt
    };
  }

  getSecret(key: string, environment: Environment = 'all'): string | null {
    this.ensureUnlocked();

    let secret = this.getSecretRaw(key, environment);
    
    if (!secret && environment !== 'all') {
      secret = this.getSecretRaw(key, 'all');
    }

    if (!secret) {
      return null;
    }

    const decryptedValue = this.cryptoManager!.decrypt(secret.value);

    const stmt = this.db!.prepare('UPDATE secrets SET last_used_at = ? WHERE id = ?');
    stmt.run(Date.now(), secret.id);

    this.auditLogger!.log('read', key, environment);

    return decryptedValue;
  }

  getSecretWithDetails(key: string, environment: Environment = 'all'): (Secret & { decryptedValue: string }) | null {
    this.ensureUnlocked();

    let secret = this.getSecretRaw(key, environment);
    
    if (!secret && environment !== 'all') {
      secret = this.getSecretRaw(key, 'all');
    }

    if (!secret) {
      return null;
    }

    const decryptedValue = this.cryptoManager!.decrypt(secret.value);

    const stmt = this.db!.prepare('UPDATE secrets SET last_used_at = ? WHERE id = ?');
    stmt.run(Date.now(), secret.id);

    this.auditLogger!.log('read', key, secret.environment);

    return {
      ...secret,
      decryptedValue
    };
  }

  private getSecretRaw(key: string, environment: Environment): Secret | null {
    const stmt = this.db!.prepare('SELECT * FROM secrets WHERE key = ? AND environment = ?');
    const row = stmt.get(key, environment) as SecretRow | null;

    if (!row) {
      return null;
    }

    return this.rowToSecret(row);
  }

  listSecrets(environment?: Environment): Secret[] {
    this.ensureUnlocked();

    let query = 'SELECT * FROM secrets';
    const params: string[] = [];

    if (environment) {
      query += ' WHERE environment = ? OR environment = ?';
      params.push(environment, 'all');
    }

    query += ' ORDER BY key, environment';

    const stmt = this.db!.prepare(query);
    const rows = stmt.all(...params) as SecretRow[];

    return rows.map(row => this.rowToSecret(row));
  }

  updateSecret(
    key: string,
    value: string,
    environment: Environment = 'all',
    options: { description?: string; tags?: string[] } = {}
  ): Secret {
    this.ensureUnlocked();

    if (Buffer.byteLength(value, 'utf8') > MAX_SECRET_VALUE_SIZE) {
      throw new SecretValueTooLargeError(MAX_SECRET_VALUE_SIZE);
    }

    const existing = this.getSecretRaw(key, environment);
    if (!existing) {
      throw new SecretNotFoundError(key, environment);
    }

    const encryptedValue = this.cryptoManager!.encrypt(value);
    const now = Date.now();

    let query = 'UPDATE secrets SET value = ?, updated_at = ?';
    const params: (string | number)[] = [encryptedValue, now];

    if (options.description !== undefined) {
      query += ', description = ?';
      params.push(options.description);
    }

    if (options.tags !== undefined) {
      query += ', tags = ?';
      params.push(JSON.stringify(options.tags));
    }

    query += ' WHERE id = ?';
    params.push(existing.id);

    const stmt = this.db!.prepare(query);
    stmt.run(...params);

    this.auditLogger!.log('write', key, environment);

    return {
      ...existing,
      value: encryptedValue,
      updated_at: now,
      description: options.description ?? existing.description,
      tags: options.tags ?? existing.tags
    };
  }

  deleteSecret(key: string, environment: Environment = 'all'): boolean {
    this.ensureUnlocked();

    const existing = this.getSecretRaw(key, environment);
    if (!existing) {
      throw new SecretNotFoundError(key, environment);
    }

    const stmt = this.db!.prepare('DELETE FROM secrets WHERE id = ?');
    const result = stmt.run(existing.id);

    this.auditLogger!.log('delete', key, environment);

    return result.changes > 0;
  }

  deleteSecretAllEnvs(key: string): number {
    this.ensureUnlocked();

    const stmt = this.db!.prepare('DELETE FROM secrets WHERE key = ?');
    const result = stmt.run(key);

    if (result.changes > 0) {
      this.auditLogger!.log('delete', key, 'all');
    }

    return result.changes;
  }

  rotateSecret(key: string, newValue: string, excludeEnvs: Environment[] = []): number {
    this.ensureUnlocked();

    const secrets = this.listSecrets().filter(s => s.key === key && !excludeEnvs.includes(s.environment));

    if (secrets.length === 0) {
      throw new SecretNotFoundError(key, 'any');
    }

    const encryptedValue = this.cryptoManager!.encrypt(newValue);
    const now = Date.now();

    for (const secret of secrets) {
      const stmt = this.db!.prepare('UPDATE secrets SET value = ?, updated_at = ? WHERE id = ?');
      stmt.run(encryptedValue, now, secret.id);
      this.auditLogger!.log('rotate', key, secret.environment);
    }

    return secrets.length;
  }

  searchSecrets(query: string): Secret[] {
    this.ensureUnlocked();

    const stmt = this.db!.prepare(`
      SELECT * FROM secrets 
      WHERE key LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'
      ORDER BY key, environment
    `);

    const escapedQuery = this.escapeLikePattern(query);
    const searchPattern = `%${escapedQuery}%`;
    const rows = stmt.all(searchPattern, searchPattern) as SecretRow[];

    return rows.map(row => this.rowToSecret(row));
  }

  private escapeLikePattern(pattern: string): string {
    return pattern.replace(/[%_\\]/g, '\\$&');
  }

  getSecretsForSync(environment: Environment): Record<string, string> {
    this.ensureUnlocked();

    const secrets = this.listSecrets(environment);
    const result: Record<string, string> = {};

    const keyMap = new Map<string, Secret>();
    
    for (const secret of secrets) {
      const existing = keyMap.get(secret.key);
      if (!existing || (secret.environment !== 'all' && existing.environment === 'all')) {
        keyMap.set(secret.key, secret);
      }
    }

    for (const [key, secret] of keyMap) {
      result[key] = this.cryptoManager!.decrypt(secret.value);
    }

    return result;
  }

  changeMasterPassword(oldPassword: string, newPassword: string): void {
    if (!this.isInitialized()) {
      throw new VaultNotInitializedError();
    }

    const tempDb = new Database(this.dbPath);
    const saltBase64 = getVaultMeta(tempDb, 'salt');
    
    if (!saltBase64) {
      tempDb.close();
      throw new VaultNotInitializedError();
    }

    const oldSalt = new Uint8Array(Buffer.from(saltBase64, 'base64'));
    const oldCrypto = new CryptoManager(oldPassword, oldSalt);

    const verificationEncrypted = getVaultMeta(tempDb, PASSWORD_VERIFICATION_KEY);
    if (!verificationEncrypted || !oldCrypto.verifyPassword(PASSWORD_VERIFICATION_VALUE, verificationEncrypted)) {
      tempDb.close();
      throw new WrongPasswordError(MAX_FAILED_ATTEMPTS);
    }

    const newSalt = CryptoManager.generateSalt();
    const newCrypto = new CryptoManager(newPassword, newSalt);

    const stmt = tempDb.prepare('SELECT * FROM secrets');
    const secrets = stmt.all() as SecretRow[];

    for (const secret of secrets) {
      const decrypted = oldCrypto.decrypt(secret.value);
      const reEncrypted = newCrypto.encrypt(decrypted);

      const updateStmt = tempDb.prepare('UPDATE secrets SET value = ? WHERE id = ?');
      updateStmt.run(reEncrypted, secret.id);
    }

    setVaultMeta(tempDb, 'salt', Buffer.from(newSalt).toString('base64'));
    
    const newVerification = newCrypto.encrypt(PASSWORD_VERIFICATION_VALUE);
    setVaultMeta(tempDb, PASSWORD_VERIFICATION_KEY, newVerification);

    oldCrypto.clearMasterKey();
    tempDb.close();

    if (!this.isLocked()) {
      this.lock();
      this.unlock(newPassword);
    }
  }

  getAuditLogger(): AuditLogger | null {
    return this.auditLogger;
  }

  private rowToSecret(row: SecretRow): Secret {
    return {
      id: row.id,
      key: row.key,
      value: row.value,
      environment: row.environment as Environment,
      description: row.description ?? undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_used_at: row.last_used_at ?? undefined,
      expires_at: row.expires_at ?? undefined
    };
  }
}

let vaultInstance: VaultManager | null = null;

export function getVaultManager(dbPath?: string): VaultManager {
  if (!vaultInstance) {
    vaultInstance = new VaultManager(dbPath);
  }
  return vaultInstance;
}

export function resetVaultManager(): void {
  if (vaultInstance) {
    vaultInstance.lock();
    vaultInstance = null;
  }
}
