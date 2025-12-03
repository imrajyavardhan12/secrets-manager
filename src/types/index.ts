export type Environment = 'dev' | 'staging' | 'prod' | 'all';
export type AuditAction = 'read' | 'write' | 'delete' | 'rotate' | 'export' | 'import';

export enum VaultState {
  NOT_INITIALIZED = 'not_initialized',
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
  LOCKED_OUT = 'locked_out'
}

export interface Secret {
  id: string;
  key: string;
  value: string;
  environment: Environment;
  description?: string;
  tags?: string[];
  created_at: number;
  updated_at: number;
  last_used_at?: number;
  expires_at?: number;
}

export interface SecretRow {
  id: string;
  key: string;
  value: string;
  environment: string;
  description: string | null;
  tags: string | null;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
  expires_at: number | null;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  created_at: number;
  last_synced_at?: number;
}

export interface ProjectRow {
  id: string;
  name: string;
  path: string;
  created_at: number;
  last_synced_at: number | null;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  action: AuditAction;
  secret_key: string;
  environment: string;
  user: string;
  ip_address?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogRow {
  id: string;
  timestamp: number;
  action: string;
  secret_key: string;
  environment: string;
  user: string;
  ip_address: string | null;
  metadata: string | null;
}

export interface VaultMeta {
  salt: string;
  version: string;
  created_at: number;
  auto_lock_timeout: number;
}

export interface RuntimeState {
  masterKey: Uint8Array | null;
  vaultState: VaultState;
  lastActivity: Date;
  autoLockTimer: Timer | null;
  failedAttempts: number;
  lockoutUntil: Date | null;
}

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

export interface ProjectConfig {
  version: string;
  project: {
    name: string;
    id: string;
  };
  environments: Environment[];
  secrets: Array<{
    key: string;
    environments: Environment[];
  }>;
}

export interface UserConfig {
  version: string;
  auto_lock_timeout: number;
  default_environment: Environment;
  preferences: {
    color_output: boolean;
    verbose: boolean;
    auto_sync: boolean;
  };
}
