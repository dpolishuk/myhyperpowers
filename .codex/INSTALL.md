# Codex Install Guide

This repository generates Codex-compatible wrappers from canonical project assets.

## 1) Regenerate wrappers

Run from repo root:

```bash
node scripts/sync-codex-skills.js --write
```

Validate drift in CI/local checks:

```bash
node scripts/sync-codex-skills.js --check
```

## 2) Install wrappers

Use the installer script:

```bash
# Global install to ~/.agents/skills
bash scripts/install-codex-plugin.sh --global

# Local install to <target>/.agents/skills
bash scripts/install-codex-plugin.sh --local --target /path/to/project
```

Useful commands:

```bash
bash scripts/install-codex-plugin.sh --status
bash scripts/install-codex-plugin.sh --version
bash scripts/install-codex-plugin.sh --global --force
```

## Installer guarantees

- Backs up existing `codex-*` wrappers before overwrite.
- Retains only the 3 newest backups.
- Safe re-run behavior: exits early when the same version is already installed (unless `--force`).
