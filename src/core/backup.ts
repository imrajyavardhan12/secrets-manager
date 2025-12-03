import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';
import { ensureDirectory } from '../storage/database.js';
import { BACKUPS_DIR, VAULT_DB_PATH, FILE_PERMISSIONS, PBKDF2_ITERATIONS } from '../utils/constants.js';
import { CryptoManager } from './crypto.js';

export interface BackupMetadata {
  version: string;
  created_at: number;
  secrets_count: number;
}

export class BackupManager {
  private vaultPath: string;
  private backupsDir: string;

  constructor(vaultPath: string = VAULT_DB_PATH, backupsDir: string = BACKUPS_DIR) {
    this.vaultPath = vaultPath;
    this.backupsDir = backupsDir;
  }

  createBackup(outputPath?: string, password?: string): { path: string; metadata: BackupMetadata } {
    ensureDirectory(this.backupsDir);

    const date = new Date().toISOString().substring(0, 10);
    const defaultPath = join(this.backupsDir, `vault-backup-${date}.enc`);
    const backupPath = outputPath ?? defaultPath;

    const vaultData = readFileSync(this.vaultPath);

    const metadata: BackupMetadata = {
      version: '1.0.0',
      created_at: Date.now(),
      secrets_count: 0
    };

    const metadataJson = JSON.stringify(metadata);
    const metadataBuffer = Buffer.from(metadataJson);
    const metadataLengthBuffer = Buffer.alloc(4);
    metadataLengthBuffer.writeUInt32BE(metadataBuffer.length);

    let finalData: Buffer;

    if (password) {
      const salt = randomBytes(16);
      const iv = randomBytes(12);
      const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');

      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([
        cipher.update(vaultData),
        cipher.final()
      ]);
      const authTag = cipher.getAuthTag();

      finalData = Buffer.concat([
        Buffer.from([1]),
        salt,
        iv,
        authTag,
        metadataLengthBuffer,
        metadataBuffer,
        encrypted
      ]);
    } else {
      finalData = Buffer.concat([
        Buffer.from([0]),
        metadataLengthBuffer,
        metadataBuffer,
        vaultData
      ]);
    }

    writeFileSync(backupPath, finalData, { mode: FILE_PERMISSIONS.VAULT_DB });

    return { path: backupPath, metadata };
  }

  restoreBackup(backupPath: string, password?: string): void {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const backupData = readFileSync(backupPath);
    const isEncrypted = backupData[0] === 1;

    let vaultData: Buffer;
    let offset = 1;

    if (isEncrypted) {
      if (!password) {
        throw new Error('Backup is encrypted. Password required.');
      }

      const salt = backupData.subarray(offset, offset + 16);
      offset += 16;
      const iv = backupData.subarray(offset, offset + 12);
      offset += 12;
      const authTag = backupData.subarray(offset, offset + 16);
      offset += 16;

      const metadataLength = backupData.readUInt32BE(offset);
      offset += 4;
      offset += metadataLength;

      const encrypted = backupData.subarray(offset);

      const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      try {
        vaultData = Buffer.concat([
          decipher.update(encrypted),
          decipher.final()
        ]);
      } catch {
        throw new Error('Failed to decrypt backup. Wrong password?');
      }
    } else {
      const metadataLength = backupData.readUInt32BE(offset);
      offset += 4;
      offset += metadataLength;
      vaultData = backupData.subarray(offset);
    }

    ensureDirectory(this.backupsDir);
    const timestamp = Date.now();
    const currentBackupPath = join(this.backupsDir, `vault-pre-restore-${timestamp}.db`);

    if (existsSync(this.vaultPath)) {
      copyFileSync(this.vaultPath, currentBackupPath);
    }

    writeFileSync(this.vaultPath, vaultData, { mode: FILE_PERMISSIONS.VAULT_DB });
  }

  getBackupInfo(backupPath: string): BackupMetadata {
    const backupData = readFileSync(backupPath);
    const isEncrypted = backupData[0] === 1;

    let offset = 1;

    if (isEncrypted) {
      offset += 16 + 12 + 16;
    }

    const metadataLength = backupData.readUInt32BE(offset);
    offset += 4;
    const metadataJson = backupData.subarray(offset, offset + metadataLength).toString();

    return JSON.parse(metadataJson);
  }

  listBackups(): Array<{ path: string; metadata: BackupMetadata }> {
    if (!existsSync(this.backupsDir)) {
      return [];
    }

    const files = readdirSync(this.backupsDir);
    const backups: Array<{ path: string; metadata: BackupMetadata }> = [];

    for (const file of files) {
      if (file.endsWith('.enc')) {
        try {
          const backupPath = join(this.backupsDir, file);
          const metadata = this.getBackupInfo(backupPath);
          backups.push({ path: backupPath, metadata });
        } catch {
          // Skip invalid backup files
        }
      }
    }

    return backups.sort((a, b) => b.metadata.created_at - a.metadata.created_at);
  }
}
