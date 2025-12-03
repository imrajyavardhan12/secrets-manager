import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { promptMasterPassword, promptSecretValue, promptOverwrite } from '../prompts.js';
import { success, displayError, info } from '../output.js';
import { validateSecretKey, validateEnvironment } from '../../utils/validation.js';
import { VaultLockedError, SecretAlreadyExistsError, EmptyValueError } from '../../utils/errors.js';
import type { Environment } from '../../types/index.js';

export function createAddCommand(): Command {
  return new Command('add')
    .description('Add a new secret')
    .argument('<key>', 'Secret key (e.g., DATABASE_URL)')
    .argument('[value]', 'Secret value (will prompt if not provided)')
    .option('-e, --env <environment>', 'Environment (dev/staging/prod/all)', 'all')
    .option('-d, --desc <text>', 'Description of the secret')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('--expires <date>', 'Expiry date (YYYY-MM-DD)')
    .action(async (key, value, options) => {
      try {
        validateSecretKey(key);
        const environment = validateEnvironment(options.env);

        const vault = getVaultManager();

        if (vault.isLocked()) {
          const password = await promptMasterPassword();
          vault.unlock(password);
        }

        if (!value) {
          value = await promptSecretValue(key);
        }

        if (!value || value.trim() === '') {
          throw new EmptyValueError();
        }

        const secretOptions: { description?: string; tags?: string[]; expiresAt?: number } = {};

        if (options.desc) {
          secretOptions.description = options.desc;
        }

        if (options.tags) {
          secretOptions.tags = options.tags.split(',').map((t: string) => t.trim());
        }

        if (options.expires) {
          secretOptions.expiresAt = new Date(options.expires).getTime();
        }

        try {
          vault.addSecret(key, value, environment as Environment, secretOptions);
          success(`Added ${key} (${environment} environment)`);
        } catch (err) {
          if (err instanceof SecretAlreadyExistsError) {
            const shouldOverwrite = await promptOverwrite(key, environment);
            if (shouldOverwrite) {
              vault.updateSecret(key, value, environment as Environment, secretOptions);
              success(`Updated ${key} (${environment} environment)`);
            }
          } else {
            throw err;
          }
        }
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
