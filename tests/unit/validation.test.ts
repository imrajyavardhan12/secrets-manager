import { describe, it, expect } from 'bun:test';
import { validatePassword, validateSecretKey, validateEnvironment, isValidSecretKey } from '../../src/utils/validation.js';
import { InvalidKeyError, InvalidEnvironmentError } from '../../src/utils/errors.js';

describe('validatePassword', () => {
  it('should accept strong password', () => {
    const result = validatePassword('StrongPass123!@#');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.strength).toBe('strong');
  });

  it('should reject short password', () => {
    const result = validatePassword('Short1!A');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 12 characters');
  });

  it('should reject password without uppercase', () => {
    const result = validatePassword('lowercase123!@#');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must include uppercase letters');
  });

  it('should reject password without lowercase', () => {
    const result = validatePassword('UPPERCASE123!@#');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must include lowercase letters');
  });

  it('should reject password without numbers', () => {
    const result = validatePassword('NoNumbers!@#ABC');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must include numbers');
  });

  it('should reject password without special characters', () => {
    const result = validatePassword('NoSpecial12345');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must include special characters');
  });

  it('should rate medium strength password', () => {
    const result = validatePassword('MediumPass12');
    expect(result.strength).toBe('medium');
  });

  it('should rate weak password', () => {
    const result = validatePassword('weak');
    expect(result.strength).toBe('weak');
  });
});

describe('validateSecretKey', () => {
  it('should accept valid keys', () => {
    expect(() => validateSecretKey('DATABASE_URL')).not.toThrow();
    expect(() => validateSecretKey('API_KEY_123')).not.toThrow();
    expect(() => validateSecretKey('A')).not.toThrow();
    expect(() => validateSecretKey('A1')).not.toThrow();
  });

  it('should reject lowercase letters', () => {
    expect(() => validateSecretKey('database_url')).toThrow(InvalidKeyError);
  });

  it('should reject keys starting with number', () => {
    expect(() => validateSecretKey('123_KEY')).toThrow(InvalidKeyError);
  });

  it('should reject special characters', () => {
    expect(() => validateSecretKey('API-KEY')).toThrow(InvalidKeyError);
    expect(() => validateSecretKey('API.KEY')).toThrow(InvalidKeyError);
    expect(() => validateSecretKey('API KEY')).toThrow(InvalidKeyError);
  });

  it('should reject empty key', () => {
    expect(() => validateSecretKey('')).toThrow(InvalidKeyError);
  });
});

describe('validateEnvironment', () => {
  it('should accept valid environments', () => {
    expect(validateEnvironment('dev')).toBe('dev');
    expect(validateEnvironment('staging')).toBe('staging');
    expect(validateEnvironment('prod')).toBe('prod');
    expect(validateEnvironment('all')).toBe('all');
  });

  it('should reject invalid environments', () => {
    expect(() => validateEnvironment('production')).toThrow(InvalidEnvironmentError);
    expect(() => validateEnvironment('development')).toThrow(InvalidEnvironmentError);
    expect(() => validateEnvironment('test')).toThrow(InvalidEnvironmentError);
  });
});

describe('isValidSecretKey', () => {
  it('should return true for valid keys', () => {
    expect(isValidSecretKey('DATABASE_URL')).toBe(true);
  });

  it('should return false for invalid keys', () => {
    expect(isValidSecretKey('database_url')).toBe(false);
    expect(isValidSecretKey('')).toBe(false);
  });
});
