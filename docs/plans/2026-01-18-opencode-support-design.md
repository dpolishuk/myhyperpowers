# OpenCode Support Design (Hyperpowers)

Date: 2026-01-18

## Goals

- Add first-class OpenCode support for this repository:
  - OpenCode commands
  - OpenCode agents
  - OpenCode skills (via opencode-skills discovery)
  - OpenCode plugins/hooks (safety guardrails)
- Also provide a publishable OpenCode plugin package:
  - npm package: `@dpolishuk/hyperpowers-opencode`
  - ships the same safety guardrails as the project-local plugin

Non-goals (initial):
- Strict workflow enforcement hooks (TDD/plan-first enforcement). We start with safety guardrails only.
- Telemetry/logging hooks.

## Project-Level OpenCode Layout

### Commands

- Source of truth in Hyperpowers: `commands/*.md`
- Mirrored into OpenCode at: `.opencode/commands/*.md`
- Command names are not prefixed (per decision) and are invoked as `/<filename>` in OpenCode.
- Command templates call skill tools produced by opencode-skills (see Skills section), e.g.
  - `Use the skills_hyperpowers_brainstorming skill exactly as written`

### Agents

- Agents are defined in `.opencode/agents/*.md`.
- Canonical agent names are preserved (per decision):
  - `code-reviewer`, `test-runner`, `codebase-investigator`, `internet-researcher`, `test-effectiveness-analyst`
- Models are pinned by explicit choice:
  - `code-reviewer`: `anthropic/claude-sonnet-4-5`
  - `test-effectiveness-analyst`: `anthropic/claude-sonnet-4-5`
  - `test-runner`: `anthropic/claude-haiku-4-5`
  - `codebase-investigator`: `anthropic/claude-haiku-4-5`
  - `internet-researcher`: `anthropic/claude-haiku-4-5`
- Permissions are set per agent via YAML frontmatter, generally read-only for analysis agents.

### Skills

- OpenCode skill support is provided via the community `opencode-skills` plugin.
- Hyperpowers skills are copied into `.opencode/skills/` with a prefix to avoid collisions:
  - `.opencode/skills/hyperpowers-<skill>/SKILL.md`
  - Frontmatter `name:` is rewritten to `hyperpowers-<skill>` to satisfy opencode-skills validation.
- Tool naming becomes:
  - `skills_hyperpowers_<skill>`

### Safety Guardrails Plugin

- Local plugin file: `.opencode/plugins/hyperpowers-safety.ts`
- Implemented using `@opencode-ai/plugin` hook:
  - `tool.execute.before`
- Current guardrails:
  - Block reading `.env` files (except `.env.example`)
  - Block editing `.git/hooks/*` (including `pre-commit`)
  - Block `git push --force` and `rm -rf`

### Config

- `.opencode/opencode.json` is used for this repo's OpenCode setup.
- It includes:
  - MCP server definitions (perplexity-mcp, context7, serena)
  - `plugin: ["opencode-skills"]`
- Root `opencode.json` is intended to be added separately as the canonical entry point for OpenCode users; it should NOT load the npm package by default (per decision). Instead it relies on in-repo `.opencode/plugins/*`.

## Publishable Plugin Package

- Location: `packages/opencode-plugin/`
- Package name: `@dpolishuk/hyperpowers-opencode`
- Exports a default OpenCode Plugin implementing the same `tool.execute.before` safety guardrails.
- Project-level `.opencode/plugins/hyperpowers-safety.ts` imports this package source to avoid duplication.

## Compatibility Notes

- OpenCode loads plugins from:
  - `.opencode/plugins/` (project)
  - `~/.config/opencode/plugins/` (global)
  - npm packages listed in `opencode.json` via the `plugin` key
- OpenCode loads commands from:
  - `.opencode/commands/*.md` (project)
  - `~/.config/opencode/commands/*.md` (global)
- OpenCode loads agents from:
  - `.opencode/agents/*.md` (project)
  - `~/.config/opencode/agents/*.md` (global)
- opencode-skills discovery order:
  - `.opencode/skills/` (project)
  - `~/.opencode/skills/` (global)
  - `~/.config/opencode/skills/` (xdg)

## Open Questions / Future Work

- Decide whether to add workflow enforcement hooks (plan-first/TDD) beyond safety.
- Add root-level `opencode.json` and document usage for OpenCode community.
- Consider publishing automation (versioning/release process).
