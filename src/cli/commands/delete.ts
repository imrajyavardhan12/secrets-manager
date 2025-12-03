import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { promptMasterPassword, promptDeleteConfirmation, promptConfirmation } from '../prompts.js';
import { success, displayError, info } from '../output.js';
import { validateSecretKey, validateEnvironment } from '../../utils/validation.js';
import type { Environment } from '../../types/index.js';

export function createDeleteCommand(): Command {
  return new Command('delete')
    .alias('rm')
    .alias('remove')
    .description('Delete a secret')
    .argument('<key>', 'Secret key to delete')
    .option('-e, --env <environment>', 'Environment', 'all')
    .option('--all-envs', 'Delete from all environments')
    .option('--force', 'Skip confirmation')
    .action(async (key, options) => {
      try {
        validateSecretKey(key);
        const environment = validateEnvironment(options.env);

        const vault = getVaultManager();

        if (vault.isLocked()) {
          const password = await promptMasterPassword();
          vault.unlock(password);
        }

        if (options.allEnvs) {
          if (!options.force) {
            const confirmed = await promptConfirmation(
              `Delete ${key} from ALL environments? This cannot be undone.`,
              false
            );
            if (!confirmed) {
              info('Deletion cancelled');
              return;
            }
          }

          const count = vault.deleteSecretAllEnvs(key);
          success(`Deleted ${key} from ${count} environment${count !== 1 ? 's' : ''}`);
        } else {
          if (!options.force) {
            const confirmed = await promptDeleteConfirmation(key, environment);
            if (!confirmed) {
              info('Deletion cancelled');
              return;
            }
          }

          vault.deleteSecret(key, environment as Environment);
          success(`Deleted ${key} (${environment} environment)`);
        }
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
