# Installing Hyperpowers for Kimi CLI

## Prerequisites

- [Kimi CLI](https://github.com/MoonshotAI/kimi-cli) installed
- Python 3.10+ with uv (for Kimi CLI)
- Git (for cloning the repository)
- Optional: jq (for MCP config merging)

## Quick Install

### Using the Install Script (Recommended)

```bash
# Clone the repository
git clone https://github.com/dpolishuk/myhyperpowers.git ~/myhyperpowers
cd ~/myhyperpowers

# Run the install script
./scripts/install-kimi-plugin.sh
```

For development (symlinks for live reload):

```bash
./scripts/install-kimi-plugin.sh --symlink
```

### Manual Install

```bash
# 1. Create config directories
mkdir -p ~/.config/agents/skills
mkdir -p ~/.config/kimi

# 2. Copy skills
cp -r .kimi/skills/* ~/.config/agents/skills/

# 3. Copy agents
cp .kimi/agents/*.yaml ~/.config/agents/
cp .kimi/agents/*-system.md ~/.config/agents/

# 4. Copy main agent
cp .kimi/hyperpowers.yaml ~/.config/agents/
cp .kimi/hyperpowers-system.md ~/.config/agents/

# 5. Copy MCP config (or merge with existing)
cp .kimi/mcp.json ~/.config/kimi/mcp.json
```

## What Gets Installed

### Skills (21 total)

Located in `~/.config/agents/skills/`:

| Skill | Description |
|-------|-------------|
| `brainstorming` | Socratic questioning for requirements refinement |
| `writing-plans` | Create detailed bd epics with tasks |
| `executing-plans` | Execute tasks iteratively with checkpoints |
| `execute-ralph` | Autonomous execution without user interruption |
| `test-driven-development` | RED-GREEN-REFACTOR cycle |
| `debugging-with-tools` | Systematic debugging workflow |
| `fixing-bugs` | Complete bug fix workflow |
| `verification-before-completion` | Evidence-based verification |
| `review-implementation` | Verify against spec |
| `refactoring-safely` | Safe refactoring with tests |
| `analyzing-test-effectiveness` | Audit test quality |
| `sre-task-refinement` | Corner case analysis |
| ... and more |

### Agents (6 subagents)

Located in `~/.config/agents/`:

| Agent | Purpose |
|-------|---------|
| `codebase-investigator` | Explore repo, verify patterns |
| `code-reviewer` | Review code against plans |
| `test-effectiveness-analyst` | Audit test quality |
| `internet-researcher` | Research external docs |
| `autonomous-reviewer` | Ralph's autonomous reviewer |
| `test-runner` | Run tests, report failures only |

### Main Agent

- `hyperpowers.yaml` - Main agent with all subagents and tools
- `hyperpowers-system.md` - System prompt with skill references

### MCP Configuration

- `~/.config/kimi/mcp.json` - MCP servers (context7 for documentation)

## Usage

### Starting Kimi with Hyperpowers

```bash
# Use the hyperpowers agent
kimi --agent-file ~/.config/agents/hyperpowers.yaml

# Or create an alias
alias kimi-hyper='kimi --agent-file ~/.config/agents/hyperpowers.yaml'
```

### Invoking Skills

```bash
# Load a skill
/skill:brainstorming

# Load a skill with a task
/skill:test-driven-development implement user login
```

### Flow Skills

Flow skills are automated multi-step workflows with Mermaid diagrams:

```bash
# Execute a flow skill (automated execution)
/flow:execute-ralph

# Execute TDD flow
/flow:test-driven-development

# Execute bug fixing flow
/flow:fixing-bugs
```

Available flow skills:
- `execute-ralph` - Autonomous epic execution
- `test-driven-development` - RED-GREEN-REFACTOR cycle
- `fixing-bugs` - Complete bug workflow
- `executing-plans` - Task execution with checkpoints
- `brainstorming` - Requirements refinement

### Using Subagents

The `Task` tool dispatches work to specialized subagents:

```
Use the codebase-investigator to find all authentication handlers
```

Kimi will automatically dispatch to the appropriate subagent based on the task.

### Beads Integration

Hyperpowers integrates with beads_viewer for issue tracking:

```bash
bd ready              # Show issues ready to work
bd list --status=open # All open issues
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id>
bd sync               # Commit changes
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
1. `~/.config/agents/skills/` (global - hyperpowers)
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

For active development on hyperpowers:

```bash
./scripts/install-kimi-plugin.sh --symlink
```

Changes to `.kimi/` files are reflected immediately.

### Script Options

```bash
./scripts/install-kimi-plugin.sh --help
./scripts/install-kimi-plugin.sh --version
./scripts/install-kimi-plugin.sh --status
./scripts/install-kimi-plugin.sh --force   # Reinstall
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
   python3 -c "import yaml; yaml.safe_load(open('$HOME/.config/agents/hyperpowers.yaml'))"
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
   ./scripts/install-kimi-plugin.sh --version
   ```

2. Force reinstall:
   ```bash
   ./scripts/install-kimi-plugin.sh --force
   ```

3. Check backups:
   ```bash
   ls ~/.config/agents/.hyperpowers-backup/
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

Remove installed files:

```bash
# Remove skills
rm -rf ~/.config/agents/skills/{analyzing-test-effectiveness,brainstorming,...}

# Remove agents
rm -f ~/.config/agents/{codebase-investigator,code-reviewer,...}.yaml
rm -f ~/.config/agents/*-system.md

# Remove main agent
rm -f ~/.config/agents/hyperpowers.yaml
rm -f ~/.config/agents/hyperpowers-system.md

# Remove version file
rm -f ~/.config/agents/.hyperpowers-version

# Optionally remove MCP config
rm -f ~/.config/kimi/mcp.json
```

## Getting Help

- Report issues: https://github.com/dpolishuk/myhyperpowers/issues
- Documentation: https://github.com/dpolishuk/myhyperpowers
- Kimi CLI Docs: https://github.com/MoonshotAI/kimi-cli
