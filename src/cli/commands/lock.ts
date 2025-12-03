import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { success, info, displayError } from '../output.js';

export function createLockCommand(): Command {
  return new Command('lock')
    .description('Lock the vault')
    .action(async () => {
      try {
        const vault = getVaultManager();

        if (!vault.isInitialized()) {
          info('Vault not initialized');
          return;
        }

        if (vault.isLocked()) {
          info('Vault is already locked');
          return;
        }

        vault.lock();
        success('Vault locked');
        info("Run 'secrets unlock' to access secrets");
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
