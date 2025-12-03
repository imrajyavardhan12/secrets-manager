import type { PasswordValidation, Environment } from '../types/index.js';
import { VALID_ENVIRONMENTS, PASSWORD_MIN_LENGTH, PASSWORD_STRONG_LENGTH } from './constants.js';
import { InvalidKeyError, InvalidEnvironmentError } from './errors.js';

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include uppercase letters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must include lowercase letters');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must include numbers');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must include special characters');
  }

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (password.length >= PASSWORD_STRONG_LENGTH && errors.length === 0) {
    strength = 'strong';
  } else if (password.length >= PASSWORD_MIN_LENGTH && errors.length <= 1) {
    strength = 'medium';
  }

  return {
    valid: errors.length === 0,
    errors,
    strength
  };
}

export function validateSecretKey(key: string): void {
  if (!key || key.trim() === '') {
    throw new InvalidKeyError(key || '(empty)');
  }

  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    throw new InvalidKeyError(key);
  }

  if (key.length > 255) {
    throw new InvalidKeyError(key);
  }
}

export function validateEnvironment(env: string): Environment {
  if (!VALID_ENVIRONMENTS.includes(env as Environment)) {
    throw new InvalidEnvironmentError(env);
  }
  return env as Environment;
}

export function isValidSecretKey(key: string): boolean {
  try {
    validateSecretKey(key);
    return true;
  } catch {
    return false;
  }
}

export function isValidEnvironment(env: string): boolean {
  return VALID_ENVIRONMENTS.includes(env as Environment);
}
