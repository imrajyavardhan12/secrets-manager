import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { promptNewMasterPassword, promptForceInit } from '../prompts.js';
import { success, warning, displayError } from '../output.js';
import { SECRETS_DIR } from '../../utils/constants.js';
import { VaultAlreadyInitializedError } from '../../utils/errors.js';

export function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize a new vault')
    .option('--force', 'Overwrite existing vault')
    .option('--timeout <mins>', 'Auto-lock timeout in minutes', '15')
    .action(async (options) => {
      try {
        const vault = getVaultManager();

        if (vault.isInitialized() && !options.force) {
          const shouldOverwrite = await promptForceInit();
          if (!shouldOverwrite) {
            return;
          }
          options.force = true;
        }

        const password = await promptNewMasterPassword();
        const timeout = parseInt(options.timeout, 10);

        vault.initialize(password, { force: options.force, timeout });

        success(`Vault initialized at ${SECRETS_DIR}/`);
        warning('Remember your master password - it cannot be recovered!');
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
