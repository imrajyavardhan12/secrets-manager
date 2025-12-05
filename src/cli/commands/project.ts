import { Command } from 'commander';
import { Database } from 'bun:sqlite';
import { getVaultManager } from '../../core/vault.js';
import { ProjectManager } from '../../core/project.js';
import { ensureUnlocked } from '../prompts.js';
import { success, info, displayError } from '../output.js';
import { validateEnvironment } from '../../utils/validation.js';
import { VAULT_DB_PATH } from '../../utils/constants.js';
import type { Environment } from '../../types/index.js';

export function createProjectCommand(): Command {
  const project = new Command('project')
    .description('Project management commands');

  project
    .command('init')
    .description('Initialize secrets for a project')
    .option('--name <name>', 'Project name (default: directory name)')
    .option('--envs <envs>', 'Environments (comma-separated)', 'dev,staging,prod')
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

        const envs = options.envs.split(',').map((e: string) => {
          return validateEnvironment(e.trim()) as Environment;
        });

        const project = projectManager.initProject(projectPath, {
          name: options.name,
          envs
        });

        db.close();

        success(`Project initialized: ${project.name}`);
        success('Created .secrets.yaml');
        success('Updated .gitignore');

        console.log();
        info('Next steps:');
        console.log('  1. Add secrets: secrets add <KEY>');
        console.log('  2. Sync to .env: secrets sync');
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });

  project
    .command('list')
    .alias('ls')
    .description('List all registered projects')
    .action(async () => {
      try {
        const vault = getVaultManager();

        if (!vault.isInitialized()) {
          info('Vault not initialized. Run: secrets init');
          process.exit(1);
        }

        await ensureUnlocked(vault);

        const db = new Database(VAULT_DB_PATH);
        const projectManager = new ProjectManager(db);
        const projects = projectManager.listProjects();

        db.close();

        if (projects.length === 0) {
          info('No projects found');
          return;
        }

        console.log();
        for (const p of projects) {
          console.log(`  ${p.name}`);
          console.log(`    Path: ${p.path}`);
          if (p.last_synced_at) {
            console.log(`    Last synced: ${new Date(p.last_synced_at).toISOString()}`);
          }
          console.log();
        }
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });

  return project;
}
