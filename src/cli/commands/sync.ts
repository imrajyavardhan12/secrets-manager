import { Command } from 'commander';
import { Database } from 'bun:sqlite';
import { getVaultManager } from '../../core/vault.js';
import { ProjectManager } from '../../core/project.js';
import { ensureUnlocked } from '../prompts.js';
import { success, info, displayError, printSyncedSecrets } from '../output.js';
import { validateEnvironment } from '../../utils/validation.js';
import { VAULT_DB_PATH, ENV_FILE } from '../../utils/constants.js';
import { ProjectNotInitializedError } from '../../utils/errors.js';
import type { Environment } from '../../types/index.js';

export function createSyncCommand(): Command {
  return new Command('sync')
    .description('Sync secrets to .env file')
    .option('-e, --env <environment>', 'Environment')
    .option('--output <file>', 'Output file', ENV_FILE)
    .option('--dry-run', 'Show what would be written without writing')
    .action(async (options) => {
      try {
        const vault = getVaultManager();

        if (!vault.isInitialized()) {
          info('Vault not initialized. Run: secrets init');
          process.exit(1);
        }

        await ensureUnlocked(vault);

        const projectPath = process.cwd();
        const db = new Database(VAULT_DB_PATH);
        const projectManager = new ProjectManager(db);

        if (!projectManager.isProjectInitialized(projectPath)) {
          db.close();
          throw new ProjectNotInitializedError();
        }

        let environment: Environment;
        if (options.env) {
          environment = validateEnvironment(options.env) as Environment;
        } else {
          environment = projectManager.detectEnvironment(projectPath) as Environment;
          info(`Using environment: ${environment} (auto-detected)`);
        }

        const secrets = vault.getSecretsForSync(environment);
        const secretKeys = Object.keys(secrets);

        if (secretKeys.length === 0) {
          info(`No secrets found for ${environment} environment`);
          db.close();
          return;
        }

        if (options.dryRun) {
          info('Dry run - would sync:');
          for (const key of secretKeys) {
            console.log(`  • ${key}`);
          }
          db.close();
          return;
        }

        projectManager.syncToEnv(projectPath, secrets, environment);
        db.close();

        printSyncedSecrets(secretKeys, environment, options.output);
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
