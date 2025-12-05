import { existsSync, unlinkSync, writeFileSync, readFileSync, chmodSync } from 'fs';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { SESSION_FILE_PATH, DEFAULT_AUTO_LOCK_TIMEOUT, FILE_PERMISSIONS, IV_LENGTH, AUTH_TAG_LENGTH } from '../utils/constants.js';
import { SessionExpiredError, SessionInvalidError } from '../utils/errors.js';

interface SessionData {
  encryptedMasterKey: string;
  sessionKey: string;
  expiresAt: number;
  createdAt: number;
}

export class SessionManager {
  private sessionPath: string;

  constructor(sessionPath: string = SESSION_FILE_PATH) {
    this.sessionPath = sessionPath;
  }

  saveSession(masterKey: Uint8Array, timeoutMinutes: number = DEFAULT_AUTO_LOCK_TIMEOUT): void {
    const sessionKey = randomBytes(32);
    const iv = randomBytes(IV_LENGTH);
    
    const cipher = createCipheriv('aes-256-gcm', sessionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(masterKey)),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    const encryptedMasterKey = Buffer.concat([iv, authTag, encrypted]).toString('base64');

    const sessionData: SessionData = {
      encryptedMasterKey,
      sessionKey: sessionKey.toString('base64'),
      expiresAt: Date.now() + (timeoutMinutes * 60 * 1000),
      createdAt: Date.now()
    };

    writeFileSync(this.sessionPath, JSON.stringify(sessionData), { mode: FILE_PERMISSIONS.VAULT_DB });
    
    try {
      chmodSync(this.sessionPath, FILE_PERMISSIONS.VAULT_DB);
    } catch {
      // Ignore permission errors on some systems
    }
  }

  loadSession(): Uint8Array | null {
    if (!this.hasValidSession()) {
      return null;
    }

    try {
      const sessionData = this.readSessionData();
      if (!sessionData) {
        return null;
      }

      if (Date.now() > sessionData.expiresAt) {
        this.deleteSession();
        return null;
      }

      const sessionKey = Buffer.from(sessionData.sessionKey, 'base64');
      const combined = Buffer.from(sessionData.encryptedMasterKey, 'base64');

      const iv = combined.subarray(0, IV_LENGTH);
      const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

      const decipher = createDecipheriv('aes-256-gcm', sessionKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return new Uint8Array(decrypted);
    } catch {
      this.deleteSession();
      return null;
    }
  }

  deleteSession(): void {
    try {
      if (existsSync(this.sessionPath)) {
        // Overwrite with zeros before deleting for security
        const fileSize = readFileSync(this.sessionPath).length;
        writeFileSync(this.sessionPath, Buffer.alloc(fileSize, 0));
        unlinkSync(this.sessionPath);
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  hasValidSession(): boolean {
    if (!existsSync(this.sessionPath)) {
      return false;
    }

    try {
      const sessionData = this.readSessionData();
      if (!sessionData) {
        return false;
      }

      if (Date.now() > sessionData.expiresAt) {
        this.deleteSession();
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  getSessionExpiresAt(): number | null {
    try {
      const sessionData = this.readSessionData();
      return sessionData?.expiresAt ?? null;
    } catch {
      return null;
    }
  }

  extendSession(timeoutMinutes: number = DEFAULT_AUTO_LOCK_TIMEOUT): boolean {
    try {
      const sessionData = this.readSessionData();
      if (!sessionData) {
        return false;
      }

      if (Date.now() > sessionData.expiresAt) {
        this.deleteSession();
        return false;
      }

      sessionData.expiresAt = Date.now() + (timeoutMinutes * 60 * 1000);
      writeFileSync(this.sessionPath, JSON.stringify(sessionData), { mode: FILE_PERMISSIONS.VAULT_DB });
      return true;
    } catch {
      return false;
    }
  }

  private readSessionData(): SessionData | null {
    try {
      const content = readFileSync(this.sessionPath, 'utf-8');
      const data = JSON.parse(content) as SessionData;
      
      if (!data.encryptedMasterKey || !data.sessionKey || !data.expiresAt) {
        return null;
      }
      
      return data;
    } catch {
      return null;
    }
  }
}

let sessionInstance: SessionManager | null = null;

export function getSessionManager(sessionPath?: string): SessionManager {
  if (!sessionInstance) {
    sessionInstance = new SessionManager(sessionPath);
  }
  return sessionInstance;
}

export function resetSessionManager(): void {
  sessionInstance = null;
}
