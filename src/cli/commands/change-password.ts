import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { promptMasterPassword, promptNewMasterPassword } from '../prompts.js';
import { success, info, displayError } from '../output.js';
import ora from 'ora';

export function createChangePasswordCommand(): Command {
  return new Command('change-password')
    .description('Change master password')
    .action(async () => {
      try {
        const vault = getVaultManager();

        if (!vault.isInitialized()) {
          info('Vault not initialized. Run: secrets init');
          return;
        }

        const currentPassword = await promptMasterPassword();
        
        console.log();
        const newPassword = await promptNewMasterPassword();

        const spinner = ora('Re-encrypting all secrets...').start();

        try {
          vault.changeMasterPassword(currentPassword, newPassword);
          spinner.succeed('Master password changed');
          success('All secrets re-encrypted');
        } catch (err) {
          spinner.fail('Failed to change password');
          throw err;
        }
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
