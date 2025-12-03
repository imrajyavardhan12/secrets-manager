import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { promptMasterPassword } from '../prompts.js';
import { printSecretValue, printSecretDetails, displayError, error } from '../output.js';
import { validateSecretKey, validateEnvironment } from '../../utils/validation.js';
import type { Environment } from '../../types/index.js';

export function createGetCommand(): Command {
  return new Command('get')
    .description('Retrieve a secret value')
    .argument('<key>', 'Secret key to retrieve')
    .option('-e, --env <environment>', 'Environment', 'all')
    .option('--show-details', 'Show metadata (created, updated, etc.)')
    .action(async (key, options) => {
      try {
        validateSecretKey(key);
        const environment = validateEnvironment(options.env);

        const vault = getVaultManager();

        if (vault.isLocked()) {
          const password = await promptMasterPassword();
          vault.unlock(password);
        }

        if (options.showDetails) {
          const secret = vault.getSecretWithDetails(key, environment as Environment);
          if (!secret) {
            error(`Secret '${key}' not found in ${environment} environment`);
            process.exit(1);
          }
          printSecretDetails(secret);
        } else {
          const value = vault.getSecret(key, environment as Environment);
          if (value === null) {
            error(`Secret '${key}' not found in ${environment} environment`);
            process.exit(1);
          }
          printSecretValue(value);
        }
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
