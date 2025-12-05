import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { promptMasterPassword } from '../prompts.js';
import { success, warning, info, displayError } from '../output.js';

export function createUnlockCommand(): Command {
  return new Command('unlock')
    .description('Unlock the vault')
    .option('--timeout <mins>', 'Auto-lock timeout in minutes', '15')
    .action(async (options) => {
      try {
        const vault = getVaultManager();

        if (!vault.isInitialized()) {
          info('Vault not initialized. Run: secrets init');
          return;
        }

        // Check if already unlocked in memory
        if (!vault.isLocked()) {
          info('Vault is already unlocked');
          return;
        }

        // Check if there's an active session
        if (vault.hasActiveSession()) {
          info('Vault is already unlocked (active session)');
          return;
        }

        const password = await promptMasterPassword();
        const timeout = parseInt(options.timeout, 10);

        vault.unlock(password, { timeout });

        success('Vault unlocked');
        warning(`Auto-lock in ${timeout} minutes`);
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
