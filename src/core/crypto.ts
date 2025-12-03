import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import { PBKDF2_ITERATIONS, KEY_LENGTH, IV_LENGTH, AUTH_TAG_LENGTH } from '../utils/constants.js';
import { DecryptionError } from '../utils/errors.js';

export class CryptoManager {
  private masterKey: Uint8Array;

  constructor(password: string, salt: Uint8Array) {
    this.masterKey = CryptoManager.deriveMasterKey(password, salt);
  }

  static deriveMasterKey(password: string, salt: Uint8Array): Uint8Array {
    const key = pbkdf2Sync(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );
    return new Uint8Array(key);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();

    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  decrypt(ciphertext: string): string {
    try {
      const combined = Buffer.from(ciphertext, 'base64');
      
      if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new DecryptionError();
      }

      const iv = combined.subarray(0, IV_LENGTH);
      const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

      const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      if (error instanceof DecryptionError) {
        throw error;
      }
      throw new DecryptionError();
    }
  }

  static generateSalt(): Uint8Array {
    return new Uint8Array(randomBytes(16));
  }

  static generateIV(): Uint8Array {
    return new Uint8Array(randomBytes(IV_LENGTH));
  }

  clearMasterKey(): void {
    if (this.masterKey) {
      this.masterKey.fill(0);
    }
  }

  verifyPassword(testValue: string, encryptedTestValue: string): boolean {
    try {
      const decrypted = this.decrypt(encryptedTestValue);
      const a = Buffer.from(decrypted, 'utf8');
      const b = Buffer.from(testValue, 'utf8');
      if (a.length !== b.length) {
        return false;
      }
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
