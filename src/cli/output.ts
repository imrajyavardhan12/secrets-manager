import chalk from 'chalk';
import type { Secret, AuditLog } from '../types/index.js';
import { SecretsError } from '../utils/errors.js';

export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

export function warning(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

export function displayError(err: Error): void {
  if (err instanceof SecretsError) {
    error(err.message);

    if (err.code === 'VAULT_NOT_INITIALIZED') {
      info('Initialize vault with: ' + chalk.cyan('secrets init'));
    } else if (err.code === 'VAULT_LOCKED') {
      info('Unlock vault with: ' + chalk.cyan('secrets unlock'));
    } else if (err.code === 'SECRET_NOT_FOUND') {
      info('List available secrets: ' + chalk.cyan('secrets list'));
    }
  } else {
    error('Unexpected error: ' + err.message);
    if (process.env.VERBOSE) {
      console.error('\nStack trace:');
      console.error(err.stack);
    }
  }
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().replace('T', ' ').substring(0, 19);
}

export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().substring(0, 10);
}

export function printSecretValue(value: string): void {
  console.log(value);
}

export function printSecretDetails(secret: Secret & { decryptedValue: string }): void {
  console.log(chalk.bold('Key:         '), secret.key);
  console.log(chalk.bold('Value:       '), secret.decryptedValue);
  console.log(chalk.bold('Environment: '), secret.environment);
  if (secret.description) {
    console.log(chalk.bold('Description: '), secret.description);
  }
  console.log(chalk.bold('Created:     '), formatDate(secret.created_at));
  console.log(chalk.bold('Updated:     '), formatDate(secret.updated_at));
  if (secret.last_used_at) {
    console.log(chalk.bold('Last Used:   '), formatDate(secret.last_used_at));
  }
  if (secret.tags && secret.tags.length > 0) {
    console.log(chalk.bold('Tags:        '), secret.tags.join(', '));
  }
  if (secret.expires_at) {
    console.log(chalk.bold('Expires:     '), formatDate(secret.expires_at));
  }
}

export function printSecretsTable(secrets: Secret[], showValues: boolean = false, cryptoDecrypt?: (value: string) => string): void {
  if (secrets.length === 0) {
    info('No secrets found');
    return;
  }

  const keyWidth = Math.max(16, ...secrets.map(s => s.key.length)) + 2;
  const envWidth = 12;
  const descWidth = 20;
  const dateWidth = 12;

  const header = [
    chalk.bold('KEY'.padEnd(keyWidth)),
    chalk.bold('ENVIRONMENT'.padEnd(envWidth)),
    chalk.bold('DESCRIPTION'.padEnd(descWidth)),
    chalk.bold('UPDATED'.padEnd(dateWidth))
  ];

  if (showValues) {
    header.push(chalk.bold('VALUE'));
  }

  console.log();
  console.log(header.join(' '));
  console.log('-'.repeat(keyWidth + envWidth + descWidth + dateWidth + (showValues ? 20 : 0)));

  for (const secret of secrets) {
    const row = [
      secret.key.padEnd(keyWidth),
      secret.environment.padEnd(envWidth),
      (secret.description || '-').substring(0, descWidth - 2).padEnd(descWidth),
      formatRelativeDate(secret.updated_at).padEnd(dateWidth)
    ];

    if (showValues && cryptoDecrypt) {
      try {
        row.push(cryptoDecrypt(secret.value));
      } catch {
        row.push('[decrypt error]');
      }
    }

    console.log(row.join(' '));
  }

  console.log();
  console.log(`${secrets.length} secret${secrets.length !== 1 ? 's' : ''} found`);
}

export function printSecretsJson(secrets: Secret[]): void {
  const output = secrets.map(s => ({
    key: s.key,
    environment: s.environment,
    description: s.description,
    created_at: new Date(s.created_at).toISOString(),
    updated_at: new Date(s.updated_at).toISOString(),
    last_used_at: s.last_used_at ? new Date(s.last_used_at).toISOString() : null,
    tags: s.tags,
    expires_at: s.expires_at ? new Date(s.expires_at).toISOString() : null
  }));

  console.log(JSON.stringify(output, null, 2));
}

export function printAuditTable(logs: AuditLog[], total: number): void {
  if (logs.length === 0) {
    info('No audit logs found');
    return;
  }

  console.log();
  console.log(chalk.bold('Audit Log'));
  console.log('-'.repeat(80));

  const timeWidth = 20;
  const actionWidth = 8;
  const keyWidth = 20;
  const envWidth = 12;
  const userWidth = 12;

  const header = [
    chalk.bold('TIMESTAMP'.padEnd(timeWidth)),
    chalk.bold('ACTION'.padEnd(actionWidth)),
    chalk.bold('SECRET'.padEnd(keyWidth)),
    chalk.bold('ENVIRONMENT'.padEnd(envWidth)),
    chalk.bold('USER'.padEnd(userWidth))
  ];

  console.log(header.join(' '));
  console.log('-'.repeat(80));

  for (const log of logs) {
    const row = [
      formatDate(log.timestamp).padEnd(timeWidth),
      log.action.padEnd(actionWidth),
      log.secret_key.substring(0, keyWidth - 2).padEnd(keyWidth),
      log.environment.padEnd(envWidth),
      log.user.padEnd(userWidth)
    ];
    console.log(row.join(' '));
  }

  console.log();
  console.log(`Showing ${logs.length} of ${total} entries`);
}

export function printSyncedSecrets(secrets: string[], environment: string, outputFile: string): void {
  success(`Synced ${secrets.length} secrets to ${outputFile}`);
  for (const key of secrets) {
    console.log(`  ${chalk.dim('•')} ${key}`);
  }
}
