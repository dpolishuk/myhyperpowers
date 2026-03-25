# @dpolishuk/hyperpowers-opencode

OpenCode package for Hyperpowers that adds safety guardrails in `opencode`.

> Note: this is the OpenCode install path. Gemini CLI users should install from `.gemini-extension/` (Gemini extension), and Claude Code users should use the marketplace plugin.

## Install

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@dpolishuk/hyperpowers-opencode"]
}
```

This package path installs only the published OpenCode plugin package. On this branch, the preferred path is still:

```bash
./scripts/install.sh --opencode
```

That installer provisions both the OpenCode assets and the shared `tm` runtime used by `tm sync` + Linear support.

Use project-root `opencode.json` for OpenCode configuration and `.opencode/` for project-local commands, plugins, agents, and skills.

## What it does

- Blocks reading `.env` files (except `.env.example`)
- Blocks editing `.git/hooks/*` (including `pre-commit`)
- Blocks `git push --force` and `rm -rf` by default
