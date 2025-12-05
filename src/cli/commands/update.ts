import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { ensureUnlocked, promptSecretValue } from '../prompts.js';
import { success, displayError } from '../output.js';
import { validateSecretKey, validateEnvironment } from '../../utils/validation.js';
import { EmptyValueError } from '../../utils/errors.js';
import type { Environment } from '../../types/index.js';

export function createUpdateCommand(): Command {
  return new Command('update')
    .description('Update an existing secret')
    .argument('<key>', 'Secret key to update')
    .argument('[value]', 'New value (will prompt if not provided)')
    .option('-e, --env <environment>', 'Environment', 'all')
    .option('-d, --desc <text>', 'Update description')
    .option('--add-tags <tags>', 'Add tags')
    .option('--remove-tags <tags>', 'Remove tags')
    .action(async (key, value, options) => {
      try {
        validateSecretKey(key);
        const environment = validateEnvironment(options.env);

        const vault = getVaultManager();
        await ensureUnlocked(vault);

        if (!value) {
          value = await promptSecretValue(key);
        }

        if (!value || value.trim() === '') {
          throw new EmptyValueError();
        }

        const updateOptions: { description?: string; tags?: string[] } = {};

        if (options.desc) {
          updateOptions.description = options.desc;
        }

        vault.updateSecret(key, value, environment as Environment, updateOptions);
        success(`Updated ${key} (${environment} environment)`);
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
