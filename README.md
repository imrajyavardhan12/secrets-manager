# secrets-cli

A local-first, encrypted secrets manager for developers. Store API keys, passwords, and sensitive data securely on your machine - not in plain text `.env` files.

## Why?

- **Encrypted at rest** - Secrets stored with AES-256-GCM encryption
- **No cloud dependency** - Everything stays on your machine
- **Environment separation** - Manage dev/staging/prod secrets separately
- **Git-friendly** - Never accidentally commit secrets again
- **Fast** - Built with Bun for instant startup

## Installation

```bash
# Using bun
bun install -g secrets-cli

# Using npm
npm install -g secrets-cli
```

## Quick Start

```bash
# Initialize your vault (one-time setup)
secrets init

# Add a secret
secrets add DATABASE_URL "postgres://localhost:5432/mydb"

# Add environment-specific secret
secrets add API_KEY "sk_live_xxx" --env prod

# Get a secret
secrets get DATABASE_URL

# List all secrets
secrets list

# Sync to .env file
secrets project init    # In your project directory
secrets sync
```

## Commands

| Command | Description |
|---------|-------------|
| `secrets init` | Initialize a new encrypted vault |
| `secrets add <key> [value]` | Add a secret |
| `secrets get <key>` | Retrieve a secret value |
| `secrets list` | List all secrets |
| `secrets update <key> [value]` | Update an existing secret |
| `secrets delete <key>` | Delete a secret |
| `secrets rotate <key>` | Rotate a secret across environments |
| `secrets lock` | Lock the vault |
| `secrets unlock` | Unlock the vault |
| `secrets project init` | Initialize secrets for a project |
| `secrets sync` | Sync secrets to .env file |
| `secrets run <cmd>` | Run command with secrets as env vars |
| `secrets export` | Export secrets to encrypted file |
| `secrets import <file>` | Import secrets from encrypted file |
| `secrets backup` | Create encrypted backup |
| `secrets restore <file>` | Restore from backup |
| `secrets audit` | View secret access logs |
| `secrets health` | Check vault health |
| `secrets change-password` | Change master password |

## Environment Support

Secrets can be scoped to specific environments:

```bash
# Add to specific environment
secrets add API_KEY "dev_key" --env dev
secrets add API_KEY "prod_key" --env prod

# Sync specific environment
secrets sync --env prod

# Run with specific environment
secrets run --env prod npm start
```

Valid environments: `dev`, `staging`, `prod`, `all` (default)

## Project Integration

```bash
# In your project directory
secrets project init

# This creates:
# - .secrets.yaml (project config, safe to commit)
# - Updates .gitignore to ignore .env files

# Sync secrets to .env
secrets sync

# Or run directly without .env file
secrets run npm start
```

## Security

- **Encryption**: AES-256-GCM with authenticated encryption
- **Key Derivation**: PBKDF2-SHA256 with 100,000 iterations
- **Storage**: SQLite database with 0600 permissions
- **Auto-lock**: Vault locks after 15 minutes of inactivity
- **Lockout**: 5-minute lockout after 3 failed password attempts
- **Audit Trail**: All secret access is logged

### Password Requirements

- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## File Locations

```
~/.secrets/
├── vault.db        # Encrypted database (0600)
├── config.json     # User preferences
└── backups/        # Automatic backups
```

## Team Sharing

```bash
# Export secrets for team member
secrets export --output team-secrets.enc
# Share file + password securely

# Team member imports
secrets import team-secrets.enc
```

## Requirements

- [Bun](https://bun.sh) v1.0+ or Node.js 18+
- macOS, Linux, or Windows (WSL2)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
