export class SecretsError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'SecretsError';
  }
}

export class VaultNotInitializedError extends SecretsError {
  constructor() {
    super('Vault not initialized. Run: secrets init', 'VAULT_NOT_INITIALIZED');
  }
}

export class VaultLockedError extends SecretsError {
  constructor() {
    super('Vault is locked. Run: secrets unlock', 'VAULT_LOCKED');
  }
}

export class VaultAlreadyInitializedError extends SecretsError {
  constructor() {
    super('Vault already exists. Use --force to overwrite.', 'VAULT_EXISTS');
  }
}

export class WrongPasswordError extends SecretsError {
  constructor(attemptsRemaining: number) {
    super(
      `Wrong password. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`,
      'WRONG_PASSWORD'
    );
  }
}

export class LockedOutError extends SecretsError {
  constructor(secondsRemaining: number) {
    super(
      `Too many failed attempts. Try again in ${secondsRemaining} seconds.`,
      'LOCKED_OUT'
    );
  }
}

export class SecretNotFoundError extends SecretsError {
  constructor(key: string, environment: string) {
    super(
      `Secret '${key}' not found in ${environment} environment`,
      'SECRET_NOT_FOUND'
    );
  }
}

export class SecretAlreadyExistsError extends SecretsError {
  constructor(key: string, environment: string) {
    super(
      `Secret '${key}' already exists in ${environment} environment`,
      'SECRET_EXISTS'
    );
  }
}

export class InvalidPasswordError extends SecretsError {
  constructor(errors: string[]) {
    super(
      `Password does not meet requirements:\n${errors.map(e => `  - ${e}`).join('\n')}`,
      'INVALID_PASSWORD'
    );
  }
}

export class InvalidKeyError extends SecretsError {
  constructor(key: string) {
    super(
      `Invalid key '${key}'. Key must contain only uppercase letters, numbers, and underscores.`,
      'INVALID_KEY'
    );
  }
}

export class InvalidEnvironmentError extends SecretsError {
  constructor(env: string) {
    super(
      `Invalid environment '${env}'. Must be one of: dev, staging, prod, all`,
      'INVALID_ENVIRONMENT'
    );
  }
}

export class VaultCorruptedError extends SecretsError {
  constructor() {
    super(
      'Vault database is corrupted. Restore from backup: secrets restore <backup-file>',
      'VAULT_CORRUPTED'
    );
  }
}

export class DecryptionError extends SecretsError {
  constructor() {
    super(
      'Failed to decrypt secret. Data may be corrupted or tampered.',
      'DECRYPTION_FAILED'
    );
  }
}

export class ProjectNotInitializedError extends SecretsError {
  constructor() {
    super(
      'Project not initialized. Run: secrets project init',
      'PROJECT_NOT_INITIALIZED'
    );
  }
}

export class PasswordMismatchError extends SecretsError {
  constructor() {
    super('Passwords do not match.', 'PASSWORD_MISMATCH');
  }
}

export class EmptyValueError extends SecretsError {
  constructor() {
    super('Value cannot be empty.', 'EMPTY_VALUE');
  }
}

export class SecretValueTooLargeError extends SecretsError {
  constructor(maxSize: number) {
    super(`Secret value exceeds maximum size of ${Math.round(maxSize / 1024)}KB.`, 'VALUE_TOO_LARGE');
  }
}

export class SessionExpiredError extends SecretsError {
  constructor() {
    super('Session expired. Please unlock the vault again.', 'SESSION_EXPIRED');
  }
}

export class SessionInvalidError extends SecretsError {
  constructor() {
    super('Invalid session. Please unlock the vault again.', 'SESSION_INVALID');
  }
}
