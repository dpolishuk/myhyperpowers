# @dpolishuk/hyperpowers-opencode

OpenCode plugin that adds Hyperpowers-style safety guardrails.

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
