import { homedir } from 'os';
import { join } from 'path';

export const SECRETS_DIR = join(homedir(), '.secrets');
export const VAULT_DB_PATH = join(SECRETS_DIR, 'vault.db');
export const CONFIG_PATH = join(SECRETS_DIR, 'config.json');
export const BACKUPS_DIR = join(SECRETS_DIR, 'backups');

export const SCHEMA_VERSION = '1.0.0';
export const APP_VERSION = '1.0.0';

export const PBKDF2_ITERATIONS = 100000;
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12;
export const AUTH_TAG_LENGTH = 16;
export const KEY_LENGTH = 32;

export const DEFAULT_AUTO_LOCK_TIMEOUT = 15;
export const MAX_FAILED_ATTEMPTS = 3;
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

export const VALID_ENVIRONMENTS = ['dev', 'staging', 'prod', 'all'] as const;

export const FILE_PERMISSIONS = {
  VAULT_DIR: 0o700,
  VAULT_DB: 0o600,
  CONFIG: 0o600,
  ENV_FILE: 0o600,
  PROJECT_CONFIG: 0o644
} as const;

export const PROJECT_CONFIG_FILE = '.secrets.yaml';
export const ENV_FILE = '.env';
export const GITIGNORE_FILE = '.gitignore';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_STRONG_LENGTH = 16;

export const AUDIT_ACTIONS = ['read', 'write', 'delete', 'rotate', 'export', 'import'] as const;

export const MAX_SECRET_VALUE_SIZE = 64 * 1024; // 64KB
