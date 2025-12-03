#!/usr/bin/env bun

import { Command } from 'commander';
import { APP_VERSION } from '../utils/constants.js';
import { displayError } from './output.js';

import { createInitCommand } from './commands/init.js';
import { createAddCommand } from './commands/add.js';
import { createGetCommand } from './commands/get.js';
import { createListCommand } from './commands/list.js';
import { createUpdateCommand } from './commands/update.js';
import { createDeleteCommand } from './commands/delete.js';
import { createRotateCommand } from './commands/rotate.js';
import { createLockCommand } from './commands/lock.js';
import { createUnlockCommand } from './commands/unlock.js';
import { createChangePasswordCommand } from './commands/change-password.js';
import { createProjectCommand } from './commands/project.js';
import { createSyncCommand } from './commands/sync.js';
import { createRunCommand } from './commands/run.js';
import { createAuditCommand } from './commands/audit.js';
import { createHealthCommand } from './commands/health.js';
import { createBackupCommand } from './commands/backup.js';
import { createRestoreCommand } from './commands/restore.js';
import { createExportCommand } from './commands/export.js';
import { createImportCommand } from './commands/import.js';

const program = new Command();

program
  .name('secrets')
  .description('A local-first, encrypted secrets manager for developers')
  .version(APP_VERSION, '-v, --version')
  .option('--verbose', 'Verbose output')
  .option('--no-color', 'Disable colored output');

program.addCommand(createInitCommand());
program.addCommand(createAddCommand());
program.addCommand(createGetCommand());
program.addCommand(createListCommand());
program.addCommand(createUpdateCommand());
program.addCommand(createDeleteCommand());
program.addCommand(createRotateCommand());
program.addCommand(createLockCommand());
program.addCommand(createUnlockCommand());
program.addCommand(createChangePasswordCommand());
program.addCommand(createProjectCommand());
program.addCommand(createSyncCommand());
program.addCommand(createRunCommand());
program.addCommand(createAuditCommand());
program.addCommand(createHealthCommand());
program.addCommand(createBackupCommand());
program.addCommand(createRestoreCommand());
program.addCommand(createExportCommand());
program.addCommand(createImportCommand());

process.on('uncaughtException', (error: Error) => {
  displayError(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  displayError(error);
  process.exit(1);
});

program.parseAsync().then(() => {
  process.exit(0);
}).catch((error) => {
  displayError(error);
  process.exit(1);
});
