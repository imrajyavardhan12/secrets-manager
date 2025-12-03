import { describe, it, expect, beforeEach } from 'bun:test';
import { CryptoManager } from '../../src/core/crypto.js';

describe('CryptoManager', () => {
  describe('deriveMasterKey', () => {
    it('should derive consistent key from same password and salt', () => {
      const password = 'TestPassword123!';
      const salt = new Uint8Array(16).fill(1);

      const key1 = CryptoManager.deriveMasterKey(password, salt);
      const key2 = CryptoManager.deriveMasterKey(password, salt);

      expect(key1).toEqual(key2);
    });

    it('should derive different keys from different passwords', () => {
      const salt = new Uint8Array(16).fill(1);

      const key1 = CryptoManager.deriveMasterKey('password1!A', salt);
      const key2 = CryptoManager.deriveMasterKey('password2!A', salt);

      expect(key1).not.toEqual(key2);
    });

    it('should derive different keys from different salts', () => {
      const password = 'TestPassword123!';

      const key1 = CryptoManager.deriveMasterKey(password, new Uint8Array(16).fill(1));
      const key2 = CryptoManager.deriveMasterKey(password, new Uint8Array(16).fill(2));

      expect(key1).not.toEqual(key2);
    });
  });

  describe('encrypt/decrypt', () => {
    let crypto: CryptoManager;

    beforeEach(() => {
      const salt = CryptoManager.generateSalt();
      crypto = new CryptoManager('TestPassword123!', salt);
    });

    it('should encrypt and decrypt correctly', () => {
      const plaintext = 'my-secret-value';
      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'my-secret-value';
      const encrypted1 = crypto.encrypt(plaintext);
      const encrypted2 = crypto.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'password!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode', () => {
      const plaintext = 'password123日本語';
      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error on wrong password', () => {
      const salt = CryptoManager.generateSalt();
      const crypto1 = new CryptoManager('correct-password!A1', salt);
      const encrypted = crypto1.encrypt('secret');

      const crypto2 = new CryptoManager('wrong-password!A1', salt);

      expect(() => crypto2.decrypt(encrypted)).toThrow();
    });

    it('should throw error on tampered data', () => {
      const encrypted = crypto.encrypt('secret');
      const buffer = Buffer.from(encrypted, 'base64');
      // Tamper with the auth tag area (bytes 12-28)
      buffer[20] ^= 0xFF;
      const tampered = buffer.toString('base64');

      expect(() => crypto.decrypt(tampered)).toThrow();
    });
  });

  describe('generateSalt', () => {
    it('should generate 16 byte salt', () => {
      const salt = CryptoManager.generateSalt();
      expect(salt.length).toBe(16);
    });

    it('should generate different salts each time', () => {
      const salt1 = CryptoManager.generateSalt();
      const salt2 = CryptoManager.generateSalt();

      expect(salt1).not.toEqual(salt2);
    });
  });

  describe('clearMasterKey', () => {
    it('should clear the master key from memory', () => {
      const salt = CryptoManager.generateSalt();
      const crypto = new CryptoManager('TestPassword123!', salt);

      const encrypted = crypto.encrypt('test');
      crypto.clearMasterKey();

      expect(() => crypto.decrypt(encrypted)).toThrow();
    });
  });
});
