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

## What it does

- Blocks reading `.env` files (except `.env.example`)
- Blocks editing `.git/hooks/*` (including `pre-commit`)
- Blocks `git push --force` and `rm -rf` by default
