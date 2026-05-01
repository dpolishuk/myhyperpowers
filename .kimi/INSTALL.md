# Installing XPowers for Kimi CLI

## Prerequisites

- [Kimi CLI](https://github.com/MoonshotAI/kimi-cli) installed
- Python 3.10+ with uv (for Kimi CLI)
- Git (for cloning the repository)
- Node.js and npm (for the shared `tm` runtime and optional Linear sync)
- Optional: jq (for MCP config merging)

## Quick Install

### Using the Install Script (Recommended)

```bash
# Clone the repository
git clone https://github.com/dpolishuk/xpowers.git ~/xpowers
cd ~/xpowers

# Run the unified installer
./scripts/install.sh --kimi

# Or install to all detected agents at once
./scripts/install.sh --all
```

For development (symlinks for live reload):

```bash
./scripts/install.sh --kimi --symlink
```

### Manual Install

```bash
# 1. Create config directories
mkdir -p ~/.config/agents/skills
mkdir -p ~/.config/agents/agents
mkdir -p ~/.config/kimi

# 2. Copy skills
cp -r .kimi/skills/* ~/.config/agents/skills/

# 3. Copy agents
cp .kimi/agents/*.yaml ~/.config/agents/agents/
cp .kimi/agents/*-system.md ~/.config/agents/agents/

# 4. Copy main agent
cp .kimi/xpowers.yaml ~/.config/agents/
cp .kimi/xpowers-system.md ~/.config/agents/

# 5. Copy MCP config (or merge with existing)
cp .kimi/mcp.json ~/.config/kimi/mcp.json

# 6. Verify the shared tm runtime
~/.local/bin/tm --help
```

## What Gets Installed

### Skills (24+ total)

Located in `~/.config/agents/skills/`:

| Skill | Description |
|-------|-------------|
| `brainstorming` | Socratic questioning for requirements refinement |
| `writing-plans` | Create detailed tm-first implementation plans with tracked tasks |
| `executing-plans` | Execute tasks iteratively with checkpoints |
| `execute-ralph` | Autonomous execution without user interruption |
| `test-driven-development` | RED-GREEN-REFACTOR cycle |
| `debugging-with-tools` | Systematic debugging workflow |
| `fixing-bugs` | Complete bug fix workflow |
| `verification-before-completion` | Evidence-based verification |
| `review-implementation` | Verify against spec |
| `refactoring-safely` | Safe refactoring with tests |
| `codex-command-refactor-design` | Command entry point for refactor design |
| `codex-command-refactor-diagnose` | Command entry point for refactor diagnosis |
| `codex-command-refactor-execute` | Command entry point for safe refactor execution |
| `analyzing-test-effectiveness` | Audit test quality |
| `sre-task-refinement` | Corner case analysis |
| ... and more |

### Agents (6 subagents)

Located in `~/.config/agents/agents/`:

| Agent | Purpose |
|-------|---------|
| `codebase-investigator` | Explore repo, verify patterns |
| `code-reviewer` | Review code against plans |
| `test-effectiveness-analyst` | Audit test quality |
| `internet-researcher` | Research external docs |
| `autonomous-reviewer` | Ralph's autonomous reviewer |
| `test-runner` | Run tests, report failures only |

### Main Agent

- `xpowers.yaml` - Main agent with all subagents and tools
- `xpowers-system.md` - System prompt with skill references

### MCP Configuration

- `~/.config/kimi/mcp.json` - MCP servers (context7 for documentation)

## Usage

### Starting Kimi with XPowers

```bash
# Use the xpowers agent
kimi --agent-file ~/.config/agents/xpowers.yaml

# Or create an alias
alias kimi-hyper='kimi --agent-file ~/.config/agents/xpowers.yaml'
```

### Invoking Skills

```bash
# Load a skill
/skill:brainstorming

# Load a skill with a task
/skill:test-driven-development implement user login
```

### Flow Skills

Flow skills are automated multi-step workflows with Mermaid diagrams. They are invoked the same way as regular skills via `/skill:`:

```bash
# Execute Ralph (autonomous epic execution)
/skill:execute-ralph

# Execute TDD flow
/skill:test-driven-development

# Execute bug fixing flow
/skill:fixing-bugs
```

Flow skills (marked with `type: flow` in frontmatter):
- `execute-ralph` - Autonomous epic execution
- `test-driven-development` - RED-GREEN-REFACTOR cycle
- `fixing-bugs` - Complete bug workflow
- `executing-plans` - Task execution with checkpoints
- `brainstorming` - Requirements refinement

**Note:** The `type: flow` metadata indicates multi-step workflows with Mermaid diagrams but doesn't change the invocation syntax. All skills use `/skill:name`.

### Using Subagents

The `Task` tool dispatches work to specialized subagents:

```
Use the codebase-investigator to find all authentication handlers
```

Kimi will automatically dispatch to the appropriate subagent based on the task.

### Task Management

XPowers is tm-first on this branch. Use `tm` for day-to-day task management, with backend-specific tools only when a backend guide explicitly requires them:

```bash
tm ready              # Show issues ready to work
tm list --status open # All open issues
tm create "Issue title" --type task --priority 2 --design "Details"
tm update <id> --status in_progress
tm close <id>
tm sync               # Sync local work and integrations
```

Current backend note for this repo: `bd` is the active backend. `br`, `tk`, and `linear` are peer backend options in the `tm` model, but projects still select exactly one canonical backend. On this repo branch, `TM_BACKEND=linear` is available as a preview backend command surface, while the existing `tm sync` Linear path remains the separate integration-oriented workflow.

Optional Linear setup for `tm sync` follow-on integration:

```bash
export LINEAR_API_KEY="lin_api_xxx"
export LINEAR_TEAM_KEY="ENG"

# Or persist for the active backend
tm config set linear.api-key "lin_api_xxx"
tm config set linear.team-key "ENG"
```

## Customization

### Override Skills

Create project-local skills that override installed ones:

```bash
mkdir -p .kimi/skills/my-custom-skill
```

Create `.kimi/skills/my-custom-skill/SKILL.md`:

```markdown
---
name: my-custom-skill
description: My custom workflow
---

# My Custom Skill

[Your workflow instructions here]
```

### Skill Priority

Skills are loaded in this order (later overrides earlier):
1. `~/.config/agents/skills/` (global - xpowers)
2. `.kimi/skills/` (project-local)

### Add Your Own Agents

Create custom agents in `~/.config/agents/`:

```yaml
# my-agent.yaml
version: 1
agent:
  name: my-agent
  extend: default
  system_prompt_path: ./my-agent-system.md
  tools:
    - "kimi_cli.tools.file:ReadFile"
    - "kimi_cli.tools.shell:Shell"
```

## Development

### Symlink Mode

For active development on xpowers:

```bash
./scripts/install.sh --kimi --symlink
```

Changes to `.kimi/` files are reflected immediately.

### Script Options

```bash
./scripts/install.sh --help
./scripts/install.sh --version
./scripts/install.sh --status
./scripts/install.sh --kimi --force   # Reinstall
```

## Troubleshooting

### Skills Not Found

1. Verify skills are installed:
   ```bash
   ls ~/.config/agents/skills/
   ```

2. Check skill has valid `SKILL.md`:
   ```bash
   cat ~/.config/agents/skills/brainstorming/SKILL.md | head -10
   ```

3. Verify frontmatter is valid YAML

### Agents Not Loading

1. Check agent YAML syntax:
   ```bash
   python3 -c "import yaml; yaml.safe_load(open('$HOME/.config/agents/xpowers.yaml'))"
   ```

2. Verify system prompt exists:
   ```bash
   ls ~/.config/agents/*-system.md
   ```

### MCP Not Working

1. Check MCP config:
   ```bash
   cat ~/.config/kimi/mcp.json
   ```

2. Verify API key is set:
   ```bash
   echo $CONTEXT7_API_KEY
   ```

3. Test MCP connection:
   ```bash
   kimi mcp list
   ```

### Upgrade Issues

1. Check current version:
   ```bash
   ./scripts/install.sh --version
   ```

2. Force reinstall:
   ```bash
   ./scripts/install.sh --kimi --force
   ```

3. Check backups:
   ```bash
   ls ~/.config/agents/.xpowers-backup/
   ```

### Kimi CLI Not Found

Install Kimi CLI:

```bash
# Using pip
pip install kimi-cli

# Or using uv
uv pip install kimi-cli

# Verify installation
kimi --version
```

## Uninstall

Using the unified installer:

```bash
./scripts/install.sh --uninstall --kimi
```

Preview what would be removed:

```bash
./scripts/install.sh --uninstall --kimi --dry-run
```

Complete removal (including backups):

```bash
./scripts/install.sh --uninstall --kimi --purge --yes
```

**Note:** MCP configuration merge is not reverted automatically. Edit `~/.config/kimi/mcp.json` manually if needed.

## Getting Help

- Report issues: https://github.com/dpolishuk/xpowers/issues
- Documentation: https://github.com/dpolishuk/xpowers
- Kimi CLI Docs: https://github.com/MoonshotAI/kimi-cli
