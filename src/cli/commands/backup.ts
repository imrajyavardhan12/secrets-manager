import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { BackupManager } from '../../core/backup.js';
import { promptMasterPassword } from '../prompts.js';
import { success, info, displayError } from '../output.js';
import { statSync } from 'fs';

export function createBackupCommand(): Command {
  return new Command('backup')
    .description('Create encrypted backup')
    .option('-o, --output <file>', 'Output file')
    .action(async (options) => {
      try {
        const vault = getVaultManager();

        if (!vault.isInitialized()) {
          info('Vault not initialized. Run: secrets init');
          process.exit(1);
        }

        if (vault.isLocked()) {
          const password = await promptMasterPassword();
          vault.unlock(password);
        }

        const backupManager = new BackupManager();
        const { path, metadata } = backupManager.createBackup(options.output);

        const stats = statSync(path);
        const sizeKB = Math.round(stats.size / 1024);

        const secrets = vault.listSecrets();

        success(`Backup created: ${path}`);
        console.log(`  Size: ${sizeKB} KB`);
        console.log(`  Secrets: ${secrets.length}`);
        console.log();
        info('Store this file securely - it contains all your secrets!');
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
