import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VaultManager } from '../../src/core/vault.js';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import {
  VaultNotInitializedError,
  VaultLockedError,
  VaultAlreadyInitializedError,
  SecretNotFoundError,
  SecretAlreadyExistsError
} from '../../src/utils/errors.js';

const TEST_DB_PATH = join(import.meta.dir, '../.test-vault.db');
const TEST_PASSWORD = 'TestPassword123!';

describe('VaultManager', () => {
  let vault: VaultManager;

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
    vault = new VaultManager(TEST_DB_PATH);
  });

  afterEach(() => {
    try {
      vault.lock();
    } catch {}
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
  });

  describe('initialization', () => {
    it('should initialize a new vault', () => {
      vault.initialize(TEST_PASSWORD);
      expect(vault.isInitialized()).toBe(true);
      expect(vault.isLocked()).toBe(false);
    });

    it('should throw when initializing existing vault without force', () => {
      vault.initialize(TEST_PASSWORD);
      vault.lock();

      const vault2 = new VaultManager(TEST_DB_PATH);
      expect(() => vault2.initialize(TEST_PASSWORD)).toThrow(VaultAlreadyInitializedError);
    });

    it('should allow force initialization', () => {
      vault.initialize(TEST_PASSWORD);
      vault.lock();

      const vault2 = new VaultManager(TEST_DB_PATH);
      vault2.initialize('NewPassword123!', { force: true });
      expect(vault2.isInitialized()).toBe(true);
    });
  });

  describe('lock/unlock', () => {
    beforeEach(() => {
      vault.initialize(TEST_PASSWORD);
    });

    it('should lock the vault', () => {
      vault.lock();
      expect(vault.isLocked()).toBe(true);
    });

    it('should unlock with correct password', () => {
      vault.lock();
      vault.unlock(TEST_PASSWORD);
      expect(vault.isLocked()).toBe(false);
    });

    it('should throw on wrong password', () => {
      vault.lock();
      expect(() => vault.unlock('WrongPassword123!')).toThrow();
    });

    it('should throw when unlocking uninitialized vault', () => {
      const newVault = new VaultManager(join(import.meta.dir, '../.nonexistent.db'));
      expect(() => newVault.unlock(TEST_PASSWORD)).toThrow(VaultNotInitializedError);
    });
  });

  describe('secrets CRUD', () => {
    beforeEach(() => {
      vault.initialize(TEST_PASSWORD);
    });

    it('should add and get a secret', () => {
      vault.addSecret('DATABASE_URL', 'postgres://localhost/db', 'dev');
      const value = vault.getSecret('DATABASE_URL', 'dev');
      expect(value).toBe('postgres://localhost/db');
    });

    it('should return null for non-existent secret', () => {
      const value = vault.getSecret('NON_EXISTENT', 'dev');
      expect(value).toBeNull();
    });

    it('should fall back to all environment', () => {
      vault.addSecret('API_KEY', 'key123', 'all');
      const value = vault.getSecret('API_KEY', 'dev');
      expect(value).toBe('key123');
    });

    it('should throw when adding duplicate secret', () => {
      vault.addSecret('KEY', 'value1', 'dev');
      expect(() => vault.addSecret('KEY', 'value2', 'dev')).toThrow(SecretAlreadyExistsError);
    });

    it('should allow same key in different environments', () => {
      vault.addSecret('DATABASE_URL', 'dev-db', 'dev');
      vault.addSecret('DATABASE_URL', 'prod-db', 'prod');

      expect(vault.getSecret('DATABASE_URL', 'dev')).toBe('dev-db');
      expect(vault.getSecret('DATABASE_URL', 'prod')).toBe('prod-db');
    });

    it('should update existing secret', () => {
      vault.addSecret('KEY', 'old-value', 'dev');
      vault.updateSecret('KEY', 'new-value', 'dev');
      expect(vault.getSecret('KEY', 'dev')).toBe('new-value');
    });

    it('should throw when updating non-existent secret', () => {
      expect(() => vault.updateSecret('NON_EXISTENT', 'value', 'dev')).toThrow(SecretNotFoundError);
    });

    it('should delete secret', () => {
      vault.addSecret('KEY', 'value', 'dev');
      vault.deleteSecret('KEY', 'dev');
      expect(vault.getSecret('KEY', 'dev')).toBeNull();
    });

    it('should throw when deleting non-existent secret', () => {
      expect(() => vault.deleteSecret('NON_EXISTENT', 'dev')).toThrow(SecretNotFoundError);
    });

    it('should list secrets', () => {
      vault.addSecret('KEY1', 'value1', 'dev');
      vault.addSecret('KEY2', 'value2', 'dev');
      vault.addSecret('KEY3', 'value3', 'prod');

      const allSecrets = vault.listSecrets();
      expect(allSecrets.length).toBe(3);

      const devSecrets = vault.listSecrets('dev');
      expect(devSecrets.length).toBe(2);
    });
  });

  describe('rotation', () => {
    beforeEach(() => {
      vault.initialize(TEST_PASSWORD);
    });

    it('should rotate secret across environments', () => {
      vault.addSecret('API_KEY', 'old-key', 'dev');
      vault.addSecret('API_KEY', 'old-key', 'prod');

      const count = vault.rotateSecret('API_KEY', 'new-key');
      
      expect(count).toBe(2);
      expect(vault.getSecret('API_KEY', 'dev')).toBe('new-key');
      expect(vault.getSecret('API_KEY', 'prod')).toBe('new-key');
    });

    it('should respect exclude environments', () => {
      vault.addSecret('API_KEY', 'old-key', 'dev');
      vault.addSecret('API_KEY', 'old-key', 'prod');

      vault.rotateSecret('API_KEY', 'new-key', ['prod']);

      expect(vault.getSecret('API_KEY', 'dev')).toBe('new-key');
      expect(vault.getSecret('API_KEY', 'prod')).toBe('old-key');
    });
  });

  describe('operations require unlock', () => {
    beforeEach(() => {
      vault.initialize(TEST_PASSWORD);
      vault.lock();
    });

    it('should throw on add when locked', () => {
      expect(() => vault.addSecret('KEY', 'value', 'dev')).toThrow(VaultLockedError);
    });

    it('should throw on get when locked', () => {
      expect(() => vault.getSecret('KEY', 'dev')).toThrow(VaultLockedError);
    });

    it('should throw on list when locked', () => {
      expect(() => vault.listSecrets()).toThrow(VaultLockedError);
    });
  });
});
