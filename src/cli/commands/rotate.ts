import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { ensureUnlocked, promptSecretValue, promptRotateConfirmation } from '../prompts.js';
import { success, warning, info, displayError, error } from '../output.js';
import { validateSecretKey, validateEnvironment } from '../../utils/validation.js';
import { EmptyValueError } from '../../utils/errors.js';
import type { Environment } from '../../types/index.js';

export function createRotateCommand(): Command {
  return new Command('rotate')
    .description('Rotate a secret across all environments')
    .argument('<key>', 'Secret key to rotate')
    .argument('[value]', 'New value (will prompt if not provided)')
    .option('--exclude <envs>', 'Exclude environments (comma-separated)')
    .action(async (key, value, options) => {
      try {
        validateSecretKey(key);

        const vault = getVaultManager();
        await ensureUnlocked(vault);

        const secrets = vault.listSecrets().filter(s => s.key === key);
        
        if (secrets.length === 0) {
          error(`Secret '${key}' not found in any environment`);
          process.exit(1);
        }

        let excludeEnvs: Environment[] = [];
        if (options.exclude) {
          excludeEnvs = options.exclude.split(',').map((e: string) => {
            return validateEnvironment(e.trim()) as Environment;
          });
        }

        const targetSecrets = secrets.filter(s => !excludeEnvs.includes(s.environment));

        if (targetSecrets.length === 0) {
          info('No secrets to rotate after applying exclusions');
          return;
        }

        if (!value) {
          value = await promptSecretValue(key);
        }

        if (!value || value.trim() === '') {
          throw new EmptyValueError();
        }

        console.log();
        info(`Found ${key} in ${targetSecrets.length} environment${targetSecrets.length !== 1 ? 's' : ''}:`);
        for (const s of targetSecrets) {
          console.log(`  • ${s.environment}`);
        }
        console.log();

        const confirmed = await promptRotateConfirmation(key, targetSecrets.length);
        if (!confirmed) {
          info('Rotation cancelled');
          return;
        }

        const count = vault.rotateSecret(key, value, excludeEnvs);
        success(`Rotated ${key} in ${count} environment${count !== 1 ? 's' : ''}`);
        warning('Remember to update external services!');
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
