import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { ensureUnlocked } from '../prompts.js';
import { printSecretsTable, printSecretsJson, displayError } from '../output.js';
import { validateEnvironment, isValidEnvironment } from '../../utils/validation.js';
import type { Environment } from '../../types/index.js';

export function createListCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List all secrets')
    .option('-e, --env <environment>', 'Filter by environment')
    .option('--format <type>', 'Output format (table/json)', 'table')
    .option('--show-values', 'Show decrypted values (use with caution)')
    .option('--tags <tags>', 'Filter by tags')
    .action(async (options) => {
      try {
        const vault = getVaultManager();
        await ensureUnlocked(vault);

        let environment: Environment | undefined;
        if (options.env) {
          environment = validateEnvironment(options.env) as Environment;
        }

        let secrets = vault.listSecrets(environment);

        if (options.tags) {
          const filterTags = options.tags.split(',').map((t: string) => t.trim().toLowerCase());
          secrets = secrets.filter(s => 
            s.tags && s.tags.some(tag => filterTags.includes(tag.toLowerCase()))
          );
        }

        if (options.format === 'json') {
          printSecretsJson(secrets);
        } else {
          printSecretsTable(secrets, options.showValues);
        }
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
