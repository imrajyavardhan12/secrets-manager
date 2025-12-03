import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { createDecipheriv, pbkdf2Sync } from 'crypto';
import { getVaultManager } from '../../core/vault.js';
import { promptMasterPassword, promptImportPassword, promptImportConfirmation } from '../prompts.js';
import { success, info, displayError, error } from '../output.js';
import { PBKDF2_ITERATIONS } from '../../utils/constants.js';
import { SecretAlreadyExistsError } from '../../utils/errors.js';
import type { Environment } from '../../types/index.js';

interface ExportedSecret {
  key: string;
  value: string;
  environment: string;
  description?: string;
  tags?: string[];
}

export function createImportCommand(): Command {
  return new Command('import')
    .description('Import secrets from encrypted file')
    .argument('<file>', 'File to import')
    .option('--password <pass>', 'Import password')
    .option('--merge', 'Merge with existing secrets')
    .action(async (file, options) => {
      try {
        if (!existsSync(file)) {
          error(`File not found: ${file}`);
          process.exit(1);
        }

        const vault = getVaultManager();

        if (!vault.isInitialized()) {
          info('Vault not initialized. Run: secrets init');
          process.exit(1);
        }

        if (vault.isLocked()) {
          const password = await promptMasterPassword();
          vault.unlock(password);
        }

        const importPassword = options.password ?? await promptImportPassword();

        const data = readFileSync(file);
        const header = data.subarray(0, 17).toString();

        if (header !== 'SECRETS_EXPORT_V1') {
          error('Invalid export file format');
          process.exit(1);
        }

        let offset = 17;
        const salt = data.subarray(offset, offset + 16);
        offset += 16;
        const iv = data.subarray(offset, offset + 12);
        offset += 12;
        const authTag = data.subarray(offset, offset + 16);
        offset += 16;
        const encrypted = data.subarray(offset);

        const key = pbkdf2Sync(importPassword, salt, PBKDF2_ITERATIONS, 32, 'sha256');
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let plaintext: string;
        try {
          plaintext = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
          ]).toString('utf8');
        } catch {
          error('Failed to decrypt. Wrong password?');
          process.exit(1);
        }

        const secrets: ExportedSecret[] = JSON.parse(plaintext);

        console.log();
        info(`Found ${secrets.length} secrets in ${file}:`);
        for (const s of secrets) {
          console.log(`  • ${s.key} (${s.environment})`);
        }
        console.log();

        const confirmed = await promptImportConfirmation(secrets.length);
        if (!confirmed) {
          info('Import cancelled');
          return;
        }

        let imported = 0;
        let updated = 0;

        for (const s of secrets) {
          try {
            vault.addSecret(s.key, s.value, s.environment as Environment, {
              description: s.description,
              tags: s.tags
            });
            imported++;
          } catch (err) {
            if (err instanceof SecretAlreadyExistsError && options.merge) {
              vault.updateSecret(s.key, s.value, s.environment as Environment, {
                description: s.description,
                tags: s.tags
              });
              updated++;
            } else if (err instanceof SecretAlreadyExistsError) {
              vault.updateSecret(s.key, s.value, s.environment as Environment, {
                description: s.description,
                tags: s.tags
              });
              updated++;
            } else {
              throw err;
            }
          }
        }

        success(`Imported ${imported} new secrets, updated ${updated} existing`);
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
