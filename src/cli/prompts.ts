import inquirer from 'inquirer';
import { validatePassword } from '../utils/validation.js';
import { PasswordMismatchError, InvalidPasswordError } from '../utils/errors.js';
import { VaultManager } from '../core/vault.js';

export async function promptPassword(message: string = 'Password'): Promise<string> {
  const { password } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message,
      mask: '*'
    }
  ]);
  return password;
}

export async function promptMasterPassword(): Promise<string> {
  return promptPassword('Master password');
}

export async function promptNewMasterPassword(): Promise<string> {
  const { password } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Create a master password',
      mask: '*',
      validate: (input: string) => {
        const result = validatePassword(input);
        if (!result.valid) {
          return result.errors[0];
        }
        return true;
      }
    }
  ]);

  const { confirmPassword } = await inquirer.prompt([
    {
      type: 'password',
      name: 'confirmPassword',
      message: 'Confirm master password',
      mask: '*'
    }
  ]);

  if (password !== confirmPassword) {
    throw new PasswordMismatchError();
  }

  return password;
}

export async function promptSecretValue(key: string): Promise<string> {
  const { value } = await inquirer.prompt([
    {
      type: 'password',
      name: 'value',
      message: `Enter value for ${key}`,
      mask: '*'
    }
  ]);
  return value;
}

export async function promptConfirmation(message: string, defaultValue: boolean = false): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue
    }
  ]);
  return confirmed;
}

export async function promptOverwrite(key: string, environment: string): Promise<boolean> {
  return promptConfirmation(
    `Secret '${key}' already exists in ${environment}. Overwrite?`,
    false
  );
}

export async function promptDeleteConfirmation(key: string, environment: string): Promise<boolean> {
  return promptConfirmation(
    `Delete ${key} (${environment})? This cannot be undone.`,
    false
  );
}

export async function promptForceInit(): Promise<boolean> {
  return promptConfirmation(
    'Vault already exists. Overwrite? All existing secrets will be lost!',
    false
  );
}

export async function promptLinkToProject(projectName: string): Promise<boolean> {
  return promptConfirmation(
    `Link to current project (${projectName})?`,
    true
  );
}

export async function promptSelectSecrets(secrets: Array<{ key: string; environment: string }>): Promise<string[]> {
  if (secrets.length === 0) {
    return [];
  }

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select secrets to export',
      choices: secrets.map(s => ({
        name: `${s.key} (${s.environment})`,
        value: `${s.key}:${s.environment}`,
        checked: true
      }))
    }
  ]);

  return selected;
}

export async function promptExportPassword(): Promise<string> {
  const { password } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Export password',
      mask: '*',
      validate: (input: string) => {
        if (input.length < 8) {
          return 'Password must be at least 8 characters';
        }
        return true;
      }
    }
  ]);

  const { confirmPassword } = await inquirer.prompt([
    {
      type: 'password',
      name: 'confirmPassword',
      message: 'Confirm password',
      mask: '*'
    }
  ]);

  if (password !== confirmPassword) {
    throw new PasswordMismatchError();
  }

  return password;
}

export async function promptImportPassword(): Promise<string> {
  return promptPassword('Import password');
}

export async function promptImportConfirmation(secretCount: number): Promise<boolean> {
  return promptConfirmation(
    `Import ${secretCount} secrets? Existing secrets will be updated.`,
    true
  );
}

export async function promptRestoreConfirmation(): Promise<boolean> {
  return promptConfirmation(
    'This will replace your current vault! Continue?',
    false
  );
}

export async function promptRotateConfirmation(key: string, envCount: number): Promise<boolean> {
  return promptConfirmation(
    `Update ${key} in ${envCount} environment${envCount !== 1 ? 's' : ''}?`,
    true
  );
}

export async function ensureUnlocked(vault: VaultManager): Promise<void> {
  // Already unlocked in memory
  if (!vault.isLocked()) {
    return;
  }

  // Try to unlock from session first (no password prompt needed)
  if (vault.unlockFromSession()) {
    return;
  }

  // Session not available or expired, prompt for password
  const password = await promptMasterPassword();
  vault.unlock(password);
}
