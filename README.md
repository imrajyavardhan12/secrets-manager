<div align="center">

# secrets-cli

### Stop storing secrets in plain text. Start encrypting them.

[![npm version](https://img.shields.io/npm/v/secrets-cli.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/secrets-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

A **local-first, encrypted secrets manager** for developers.  
Store API keys, passwords, and sensitive data securely on your machine — not in plain text `.env` files.

[Installation](#-installation) •
[Quick Start](#-quick-start) •
[Commands](#-commands) •
[Security](#-security)

</div>

---

## The Problem

```bash
# Your .env file right now:
DATABASE_URL=postgres://admin:supersecret123@prod.db.com:5432/myapp
STRIPE_SECRET_KEY=sk_live_abc123xyz
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Plain text. Unencrypted. One `git add .` away from disaster.**

## The Solution

```bash
$ secrets add STRIPE_SECRET_KEY
Enter value for STRIPE_SECRET_KEY: ••••••••••••••••
✓ Secret added: STRIPE_SECRET_KEY (all)

$ secrets list
┌─────────────────────┬─────────────┬─────────────────────┐
│ Key                 │ Environment │ Updated             │
├─────────────────────┼─────────────┼─────────────────────┤
│ STRIPE_SECRET_KEY   │ all         │ 2 seconds ago       │
│ DATABASE_URL        │ prod        │ 5 minutes ago       │
│ AWS_SECRET_KEY      │ all         │ 1 hour ago          │
└─────────────────────┴─────────────┴─────────────────────┘
```

**Encrypted with AES-256-GCM. Protected by your master password. Always.**

---

## Why secrets-cli?

| Feature | `.env` files | secrets-cli |
|---------|:------------:|:-----------:|
| Encrypted at rest | ❌ | ✅ |
| Environment separation | ❌ | ✅ |
| Audit trail | ❌ | ✅ |
| Auto-lock protection | ❌ | ✅ |
| Brute-force protection | ❌ | ✅ |
| Team sharing (encrypted) | ❌ | ✅ |
| Works offline | ✅ | ✅ |
| No cloud dependency | ✅ | ✅ |

---

## ✨ Features

- **Military-grade encryption** — AES-256-GCM with PBKDF2 key derivation (100K iterations)
- **Environment separation** — Manage `dev`, `staging`, and `prod` secrets separately
- **Auto-lock** — Vault automatically locks after 15 minutes of inactivity
- **Brute-force protection** — Locks out after 3 failed attempts
- **Audit logging** — Track every secret access
- **Team sharing** — Export encrypted bundles for your team
- **Git-friendly** — Never accidentally commit secrets again
- **Blazing fast** — Built with Bun for instant startup

---

## 📦 Installation

**Requires [Bun](https://bun.sh) v1.0+**

```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Install secrets-cli
bun install -g secrets-cli
```

Verify installation:

```bash
secrets --version
```

---

## 🚀 Quick Start

### 1. Initialize your vault

```bash
secrets init
```

You'll create a master password. **Don't forget it** — there's no recovery option.

### 2. Add your secrets

```bash
# Interactive (hidden input)
secrets add DATABASE_URL

# Or inline
secrets add API_KEY "sk_live_xxx" --env prod
```

### 3. Use your secrets

```bash
# Get a single secret
secrets get DATABASE_URL

# Sync to .env file
secrets sync

# Or inject directly into a command
secrets run npm start
```

---

## 📖 Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `secrets init` | Initialize a new encrypted vault |
| `secrets add <key> [value]` | Add a secret (prompts for value if not provided) |
| `secrets get <key>` | Retrieve and display a secret |
| `secrets list` | List all secrets in a table |
| `secrets update <key> [value]` | Update an existing secret |
| `secrets delete <key>` | Delete a secret |
| `secrets rotate <key>` | Rotate a secret across all environments |

### Vault Management

| Command | Description |
|---------|-------------|
| `secrets lock` | Lock the vault immediately |
| `secrets unlock` | Unlock the vault |
| `secrets change-password` | Change your master password |
| `secrets health` | Check vault health and stats |
| `secrets audit [key]` | View access logs |

### Project Integration

| Command | Description |
|---------|-------------|
| `secrets project init` | Initialize secrets for current project |
| `secrets project list` | List linked projects |
| `secrets sync` | Sync secrets to `.env` file |
| `secrets run <cmd>` | Run command with secrets injected |

### Backup & Share

| Command | Description |
|---------|-------------|
| `secrets backup` | Create encrypted backup |
| `secrets restore <file>` | Restore from backup |
| `secrets export` | Export secrets for team sharing |
| `secrets import <file>` | Import shared secrets |

---

## 🌍 Environment Support

Manage different values for each environment:

```bash
# Development
secrets add API_URL "http://localhost:3000" --env dev

# Staging  
secrets add API_URL "https://staging.api.com" --env staging

# Production
secrets add API_URL "https://api.com" --env prod
```

Sync or run with a specific environment:

```bash
secrets sync --env prod
secrets run --env staging npm test
```

| Environment | Use Case |
|-------------|----------|
| `dev` | Local development |
| `staging` | Testing/QA |
| `prod` | Production |
| `all` | Shared across all (default) |

---

## 🔗 Project Integration

### Automatic .env Generation

```bash
cd your-project
secrets project init    # One-time setup
secrets sync            # Generate .env from vault
```

### Run Without .env Files

Skip `.env` files entirely — inject secrets directly:

```bash
secrets run npm start
secrets run --env prod docker-compose up
secrets run python manage.py runserver
```

---

## 👥 Team Sharing

Share secrets securely with your team:

```bash
# Export (creates encrypted file)
secrets export --output secrets.enc
# Share the file via Slack, email, etc.
# Share the password via a different channel!

# Team member imports
secrets import secrets.enc
```

---

## 🔒 Security

### Encryption Details

| Component | Implementation |
|-----------|----------------|
| **Cipher** | AES-256-GCM (authenticated encryption) |
| **Key Derivation** | PBKDF2-SHA256, 100,000 iterations |
| **Storage** | SQLite with 0600 permissions |
| **Salt** | Unique 128-bit salt per vault |
| **IV** | Random 96-bit IV per encryption |

### Protection Mechanisms

- **Auto-lock**: Vault locks after 15 minutes of inactivity
- **Brute-force protection**: 5-minute lockout after 3 failed attempts
- **Memory safety**: Keys are cleared from memory on lock
- **Audit trail**: Every access is logged with timestamp

### Password Requirements

Your master password must have:
- Minimum 12 characters
- Uppercase letter (A-Z)
- Lowercase letter (a-z)
- Number (0-9)
- Special character (!@#$%^&*...)

---

## 📁 File Locations

```
~/.secrets/
├── vault.db        # Encrypted database (chmod 600)
├── config.json     # User preferences
└── backups/        # Encrypted backups
```

---

## 🖥️ System Requirements

- **Runtime**: [Bun](https://bun.sh) v1.0+
- **OS**: macOS, Linux, Windows (WSL2)

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT © [Rajyavardhan Singh](https://github.com/imrajyavardhan12)

---

<div align="center">

**If this project helped you, consider giving it a ⭐**

[Report Bug](https://github.com/imrajyavardhan12/secrets-manager/issues) •
[Request Feature](https://github.com/imrajyavardhan12/secrets-manager/issues)

</div>
