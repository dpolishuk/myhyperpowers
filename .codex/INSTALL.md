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
# Global install to ~/.codex/skills
bash scripts/install-codex-plugin.sh --global

# Local install to <target>/.codex/skills
bash scripts/install-codex-plugin.sh --local --target /path/to/project
```

## 3) Invoke wrappers explicitly in Codex

Codex wrappers are skills. Invoke them explicitly with `$skill-name`:

```text
$codex-command-write-plan Draft an implementation plan for OAuth login.
$codex-command-execute-plan Execute task bd-123 with TDD.
$codex-skill-executing-plans Continue the current epic from bd ready state.
```

You can also open `/skills` in Codex UI and select the same skills there.

These wrappers are not custom slash-command registrations; they are skill invocations.

Useful commands:

```bash
bash scripts/install-codex-plugin.sh --status
bash scripts/install-codex-plugin.sh --version
bash scripts/install-codex-plugin.sh --codex-home /custom/.codex
bash scripts/install-codex-plugin.sh --global --force
```

## Installer guarantees

- Backs up existing `codex-*` wrappers before overwrite.
- Retains only the 3 newest backups.
- Safe re-run behavior: exits early when the same version is already installed (unless `--force`).
