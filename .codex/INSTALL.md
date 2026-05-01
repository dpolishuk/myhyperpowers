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

Use the unified installer (auto-syncs wrappers if needed):

```bash
# Install to ~/.codex/skills (global)
./scripts/install.sh --codex

# Or install to all detected agents at once
./scripts/install.sh --all
```

## 3) Invoke wrappers explicitly in Codex

Codex wrappers are skills. Invoke them explicitly with `$skill-name`:

```text
$codex-command-write-plan Draft an implementation plan for OAuth login.
$codex-command-execute-plan Execute task bd-123 with TDD.
$codex-skill-executing-plans Continue the current epic from tm ready state.
```

You can also open `/skills` in Codex UI and select the same skills there.

These wrappers are not custom slash-command registrations; they are skill invocations.

Useful commands:

```bash
./scripts/install.sh --status     # Show install state for all agents
./scripts/install.sh --version    # Show xpowers version
./scripts/install.sh --codex --force  # Force reinstall Codex wrappers
```

## Installer guarantees

- Backs up existing `codex-*` wrappers before overwrite.
- Retains only the 3 newest backups.
- Safe re-run behavior: detects version and shows upgrade path.

## Uninstall

Using the unified installer:

```bash
./scripts/install.sh --uninstall --codex
```

Preview what would be removed:

```bash
./scripts/install.sh --uninstall --codex --dry-run
```

Complete removal (including backups):

```bash
./scripts/install.sh --uninstall --codex --purge --yes
```
