# Installing Hyperpowers for OpenCode

This is the OpenCode install path for the multi-host Hyperpowers project.
For Gemini CLI, install from `.gemini-extension/`, and for Claude Code, use the Claude marketplace plugin.

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed
- [bun](https://bun.sh) for runtime and dependency management
- Git installed (for cloning)

## Quick Install

### Option 1: Using the Install Script (Recommended)

From the hyperpowers repository:

```bash
# Clone the repository
git clone https://github.com/dpolishuk/hyperpowers.git ~/hyperpowers
cd ~/hyperpowers

# Run the install script
./scripts/install-opencode-plugin.sh
```

For development (symlinks for live reload):

```bash
./scripts/install-opencode-plugin.sh --symlink
```

### Option 2: Manual Install

```bash
# 1. Clone to config directory
mkdir -p ~/.config/opencode
git clone https://github.com/dpolishuk/hyperpowers.git ~/.config/opencode/hyperpowers

# 2. Register plugin
mkdir -p ~/.config/opencode/plugins
ln -sf ~/.config/opencode/hyperpowers/.opencode/plugins/hyperpowers-skills.ts ~/.config/opencode/plugins/
ln -sf ~/.config/opencode/hyperpowers/.opencode/plugins/task-context-orchestrator.ts ~/.config/opencode/plugins/
ln -sf ~/.config/opencode/hyperpowers/.opencode/plugins/hyperpowers-safety.ts ~/.config/opencode/plugins/

# 3. Install dependencies
cd ~/.config/opencode
bun install

# 4. Restart OpenCode
opencode reload
```

## What Gets Installed

| Type | Location | Source |
|------|----------|--------|
| Plugins | `~/.config/opencode/plugins/` | `.opencode/plugins/*.ts` |
| Skills | `~/.config/opencode/skills/` | `.opencode/skills/*/` |
| Agents | `~/.config/opencode/agents/` | `.opencode/agents/*.md` |
| Commands | `~/.config/opencode/commands/` | `.opencode/commands/*.md` |
| Task Context Cache | `~/.config/opencode/cache/task-context/` | `.opencode/plugins/task-context-orchestrator.ts` |

## How It Works

The Hyperpowers OpenCode plugin does the following:

1. **Discovers skills** from XDG/config directories
2. **Exposes tools** for each skill discovered
3. **Loads skill content** when invoked via tool calls
4. **Integrates with agents** for specialized tasks

### Active Task Context Workflow

`task-context-orchestrator.ts` is the active OpenCode task-context plugin for this workflow:

- Pre-task: fetches and merges Serena + Supermemory context (Serena precedence)
- Post-task: writes JSON + narrative summaries to Serena + Supermemory
- Failure mode: non-blocking, with structured logs in `.opencode/cache/task-context/errors.log`

`cass-memory.ts` is legacy/reference only and is not the active default for per-task context in this workflow.

### Skill Discovery Order

Skills are loaded in this order (later overrides earlier):

1. `~/.config/opencode/skills/` (global)
2. `~/.opencode/skills/` (user home)
3. `.opencode/skills/` (project-local)

### Plugin Architecture

```
.opencode/
├── plugins/
│   ├── hyperpowers-skills.ts    # Main skill discovery plugin
│   ├── task-context-orchestrator.ts # Serena+Supermemory task context orchestration
│   └── hyperpowers-safety.ts    # Safety checks
├── skills/                       # Skill definitions (SKILL.md)
├── agents/                       # Agent prompts
├── commands/                     # Slash command definitions
└── package.json                  # Dependencies
```

## Usage

After installation, restart OpenCode:

```bash
opencode reload
# or restart your OpenCode session
```

### Available Skills

Once installed, these skills are available:

| Skill | Description |
|-------|-------------|
| `brainstorming` | Socratic questioning for requirements refinement |
| `writing-plans` | Create detailed implementation plans |
| `executing-plans` | Implement tasks with continuous tracking |
| `test-driven-development` | RED-GREEN-REFACTOR cycle enforcement |
| `debugging-with-tools` | Systematic debugging workflow |
| `fixing-bugs` | Complete bug fixing workflow |
| `verification-before-completion` | Evidence-based verification |
| `review-implementation` | Review against spec and standards |
| `sre-task-refinement` | Corner case analysis (uses Opus 4.1) |
| `analyzing-test-effectiveness` | Audit test quality |
| `refactoring-safely` | Safe refactoring (change→test→commit) |
| `writing-skills` | TDD for documentation |

### Invoking Skills

In the OpenCode TUI, skills are exposed as tools. The AI will automatically invoke relevant skills based on context.

## Personal Skills

Create your own skills in `~/.config/opencode/skills/`:

```bash
mkdir -p ~/.config/opencode/skills/my-skill
```

Create `~/.config/opencode/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Use when [condition] - [what it does] (min 20 chars)
allowed-tools:
  - read
  - edit
  - grep
---

# My Skill

[Your skill content here]
```

**Skill Priority:**
- Project skills (`.opencode/skills/`) highest priority
- Personal skills (`~/.config/opencode/skills/`) medium priority
- Hyperpowers skills lowest priority

## Project Skills

Create project-specific skills in your OpenCode project:

```bash
# In your OpenCode project
mkdir -p .opencode/skills/my-project-skill
```

Create `.opencode/skills/my-project-skill/SKILL.md`:

```markdown
---
name: my-project-skill
description: Use when [condition] - [what it does]
---

# My Project Skill

[Your skill content here]
```

## Commands

All hyperpowers commands are auto-discovered from the cloned repository:

- `/brainstorm` - Interactive design refinement
- `/write-plan` - Create implementation plan
- `/execute-plan` - Execute plan with checkpoints
- `/analyze-tests` - Audit test quality
- `/review-implementation` - Verify implementation fidelity
- `/beads-triage` - Run `bv --robot-triage` and return raw JSON
- `/hyperpowers-version` - Show hyperpowers plugin version and installation status

## Beads Triage

`/beads-triage [optional args]` runs `bv --robot-triage` and returns raw JSON only. If `bv` is missing, the skill installs it using the official install script before running triage.

## Development

### Live Reload Development

For development, use symlinks to enable live reload:

```bash
./scripts/install-opencode-plugin.sh --symlink
```

Changes to `.opencode/` files will be reflected immediately upon OpenCode reload.

### Adding New Skills

1. Create a new directory in `.opencode/skills/<skill-name>/`
2. Add `SKILL.md` with frontmatter
3. Reinstall the plugin (or use symlinks for dev)
4. Reload OpenCode: `opencode reload`

### Plugin Development

The main plugin is in `.opencode/plugins/hyperpowers-skills.ts`:

- Discovers `SKILL.md` files using `Bun.glob()`
- Parses frontmatter with `gray-matter`
- Validates with `zod` schemas
- Exposes tools via `@opencode-ai/plugin` SDK

## Updating

```bash
cd ~/.config/opencode/hyperpowers
git pull
```

If using symlinks, changes are reflected immediately after reload.
If using copy mode, rerun the install script.

## Troubleshooting

### Plugin not loading

1. Check symlink exists: `ls -la ~/.config/opencode/plugins/`
2. Check OpenCode logs: `opencode --log-level=debug`
3. Verify bun is installed: `bun --version`

### Skills not found

1. Verify skills directory exists: `ls ~/.config/opencode/hyperpowers/.opencode/skills/`
2. Check each skill has `SKILL.md` file
3. Verify frontmatter is valid (use `--log-level=debug`)

### Dependencies missing

Reinstall dependencies:

```bash
cd ~/.config/opencode
bun install
```

## Uninstall

Remove installed files:

```bash
rm -rf ~/.config/opencode/hyperpowers
rm -rf ~/.config/opencode/plugins/hyperpowers-*.ts
rm -rf ~/.config/opencode/skills/hyperpowers-*
rm -rf ~/.config/opencode/agents/*
rm -rf ~/.config/opencode/commands/*
rm -rf ~/.config/opencode/cass-memory

# Keep dependencies or clean all:
rm -rf ~/.config/opencode/node_modules
```

## Getting Help

- Report issues: https://github.com/dpolishuk/hyperpowers/issues
- Documentation: https://github.com/dpolishuk/hyperpowers
- OpenCode Docs: https://opencode.ai/docs/
