// Test setup file
// This runs before all tests

import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_VAULT_DIR = join(import.meta.dir, '.test-secrets');

export function cleanupTestVault(): void {
  if (existsSync(TEST_VAULT_DIR)) {
    rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
  }
}

// Clean up before tests
cleanupTestVault();
