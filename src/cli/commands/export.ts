import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { createCipheriv, pbkdf2Sync, randomBytes } from 'crypto';
import { getVaultManager } from '../../core/vault.js';
import { promptMasterPassword, promptExportPassword, promptSelectSecrets } from '../prompts.js';
import { success, warning, info, displayError } from '../output.js';
import { validateEnvironment } from '../../utils/validation.js';
import { PBKDF2_ITERATIONS, FILE_PERMISSIONS } from '../../utils/constants.js';
import type { Environment } from '../../types/index.js';

export function createExportCommand(): Command {
  return new Command('export')
    .description('Export secrets to encrypted file')
    .option('-o, --output <file>', 'Output file', 'secrets.enc')
    .option('-e, --env <environment>', 'Environment to export')
    .option('--password <pass>', 'Export password')
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

        let environment: Environment | undefined;
        if (options.env) {
          environment = validateEnvironment(options.env) as Environment;
        }

        const secrets = vault.listSecrets(environment);

        if (secrets.length === 0) {
          info('No secrets to export');
          return;
        }

        const selected = await promptSelectSecrets(
          secrets.map(s => ({ key: s.key, environment: s.environment }))
        );

        if (selected.length === 0) {
          info('No secrets selected');
          return;
        }

        const exportPassword = options.password ?? await promptExportPassword();

        const exportData: Array<{
          key: string;
          value: string;
          environment: string;
          description?: string;
          tags?: string[];
        }> = [];

        for (const selector of selected) {
          const [key, env] = selector.split(':');
          const secret = secrets.find(s => s.key === key && s.environment === env);
          if (secret) {
            const decryptedValue = vault.getSecret(key, env as Environment);
            if (decryptedValue) {
              exportData.push({
                key: secret.key,
                value: decryptedValue,
                environment: secret.environment,
                description: secret.description,
                tags: secret.tags
              });
            }
          }
        }

        const plaintext = JSON.stringify(exportData);
        const salt = randomBytes(16);
        const iv = randomBytes(12);
        const key = pbkdf2Sync(exportPassword, salt, PBKDF2_ITERATIONS, 32, 'sha256');

        const cipher = createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([
          cipher.update(plaintext, 'utf8'),
          cipher.final()
        ]);
        const authTag = cipher.getAuthTag();

        const output = Buffer.concat([
          Buffer.from('SECRETS_EXPORT_V1'),
          salt,
          iv,
          authTag,
          encrypted
        ]);

        writeFileSync(options.output, output, { mode: FILE_PERMISSIONS.VAULT_DB });

        success(`Exported ${exportData.length} secrets to ${options.output}`);
        warning('Share this file and password securely with your team');
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
