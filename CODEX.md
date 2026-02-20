# Hyperpowers for Codex

This repo ships a Codex-adapted skill pack under `.agents/skills`.

## What changed vs Claude Code

- Claude-only features (hooks and slash commands) are not included.
- Skills include a short Codex compatibility note explaining how to interpret
  Claude-specific terms (e.g., “Skill tool”, “TodoWrite”, “Task()”).
- `dispatching-parallel-agents` now uses `spawn_agent` + `multi_tool_use.parallel`.
- A new skill, `hyperpowers-agents`, maps the specialized agent prompts into Codex subagents.

## Install locations (per Codex docs)

- Repo-level skills: `.agents/skills` (checked in)
- User-level skills: `~/.agents/skills`

Codex supports symlinked skills. This repo is set up so you can symlink into your user folder.

## Quick install (local)

```bash
mkdir -p ~/.agents/skills
for d in /Users/ryan/src/hyper/.agents/skills/*; do
  name=$(basename "$d")
  [ -e "$HOME/.agents/skills/$name" ] || ln -s "$d" "$HOME/.agents/skills/$name"
done
```

Optional backward-compat install (older Codex builds):

```bash
for d in /Users/ryan/src/hyper/.agents/skills/*; do
  name=$(basename "$d")
  [ -e "$HOME/.codex/skills/$name" ] || ln -s "$d" "$HOME/.codex/skills/$name"
done
```

## Usage

- Ask for a skill by name in your prompt (e.g., “Use `test-driven-development`”).
- Or rely on automatic skill matching using each SKILL’s description.
- Use `hyperpowers-agents` when you want to spawn specialized subagents.
