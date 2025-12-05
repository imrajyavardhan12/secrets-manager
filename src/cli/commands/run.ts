import { Command } from 'commander';
import { spawn } from 'bun';
import { Database } from 'bun:sqlite';
import { getVaultManager } from '../../core/vault.js';
import { ProjectManager } from '../../core/project.js';
import { ensureUnlocked } from '../prompts.js';
import { info, displayError } from '../output.js';
import { validateEnvironment } from '../../utils/validation.js';
import { VAULT_DB_PATH } from '../../utils/constants.js';
import { ProjectNotInitializedError } from '../../utils/errors.js';
import type { Environment } from '../../types/index.js';

export function createRunCommand(): Command {
  return new Command('run')
    .description('Run a command with secrets injected as environment variables')
    .argument('<command...>', 'Command to run')
    .option('-e, --env <environment>', 'Environment')
    .allowUnknownOption(true)
    .action(async (commandArgs, options) => {
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

        let environment: Environment;
        if (options.env) {
          environment = validateEnvironment(options.env) as Environment;
        } else {
          environment = projectManager.detectEnvironment(projectPath) as Environment;
        }

        const secrets = vault.getSecretsForSync(environment);
        const secretCount = Object.keys(secrets).length;

        db.close();

        if (secretCount > 0) {
          info(`Injecting ${secretCount} secrets into environment`);
        }
        info(`Running: ${commandArgs.join(' ')}`);
        console.log();

        const [cmd, ...args] = commandArgs;

        const proc = spawn({
          cmd: [cmd, ...args],
          env: { ...process.env, ...secrets },
          cwd: projectPath,
          stdout: 'inherit',
          stderr: 'inherit',
          stdin: 'inherit'
        });

        const exitCode = await proc.exited;
        process.exit(exitCode);
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
