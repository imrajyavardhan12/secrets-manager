import { Command } from 'commander';
import { getVaultManager } from '../../core/vault.js';
import { ensureUnlocked } from '../prompts.js';
import { printAuditTable, displayError, info } from '../output.js';
import type { AuditAction } from '../../types/index.js';

export function createAuditCommand(): Command {
  return new Command('audit')
    .description('View audit logs')
    .argument('[key]', 'Filter by secret key')
    .option('--action <type>', 'Filter by action (read/write/delete/rotate)')
    .option('--limit <n>', 'Number of entries', '50')
    .option('--format <type>', 'Output format (table/json)', 'table')
    .action(async (key, options) => {
      try {
        const vault = getVaultManager();

        if (!vault.isInitialized()) {
          info('Vault not initialized. Run: secrets init');
          process.exit(1);
        }

        await ensureUnlocked(vault);

        const auditLogger = vault.getAuditLogger();
        if (!auditLogger) {
          info('Audit logger not available');
          process.exit(1);
        }

        const limit = parseInt(options.limit, 10);
        const logs = auditLogger.getLogs({
          secretKey: key,
          action: options.action as AuditAction,
          limit
        });

        const total = auditLogger.getLogCount(key);

        if (options.format === 'json') {
          console.log(JSON.stringify(logs, null, 2));
        } else {
          printAuditTable(logs, total);
        }
      } catch (err) {
        displayError(err as Error);
        process.exit(1);
      }
    });
}
