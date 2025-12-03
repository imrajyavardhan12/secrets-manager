import { Command } from 'commander';
import { resetVaultManager } from '../../core/vault.js';
import { BackupManager } from '../../core/backup.js';
import { promptRestoreConfirmation, promptPassword } from '../prompts.js';
import { success, info, warning, displayError } from '../output.js';

export function createRestoreCommand(): Command {
  return new Command('restore')
    .description('Restore from backup')
    .argument('<file>', 'Backup file to restore')
    .option('--force', 'Overwrite current vault')
    .option('--password <pass>', 'Backup password (if encrypted)')
    .action(async (file, options) => {
      try {
        const backupManager = new BackupManager();

        let metadata;
        try {
          metadata = backupManager.getBackupInfo(file);
        } catch {
          info('Could not read backup metadata');
        }

        if (metadata) {
          console.log();
          console.log('Backup Information:');
          console.log(`  Created: ${new Date(metadata.created_at).toISOString()}`);
          console.log(`  Version: ${metadata.version}`);
          console.log();
        }

        if (!options.force) {
          warning('This will replace your current vault!');
          const confirmed = await promptRestoreConfirmation();
          if (!confirmed) {
            info('Restore cancelled');
            return;
          }
        }

        let password = options.password;
        if (!password) {
          try {
            backupManager.restoreBackup(file);
          } catch (err: unknown) {
            const error = err as Error;
            if (error.message.includes('encrypted')) {
              password = await promptPassword('Backup password');
              backupManager.restoreBackup(file, password);
            } else {
              throw err;
            }
          }
        } else {
          backupManager.restoreBackup(file, password);
        }

        resetVaultManager();

        success('Vault restored from backup');
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
