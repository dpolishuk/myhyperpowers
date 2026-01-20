# Installing Hyperpowers for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed
- Node.js installed
- Git installed

## Installation Steps

### 1. Install Hyperpowers

```bash
mkdir -p ~/.config/opencode/hyperpowers
git clone https://github.com/dpolishuk/hyperpowers.git ~/.config/opencode/hyperpowers
```

### 2. Register Plugin

Create a symlink so OpenCode discovers the plugin:

```bash
mkdir -p ~/.config/opencode/plugins
ln -sf ~/.config/opencode/hyperpowers/.opencode/plugins/hyperpowers-skills.ts ~/.config/opencode/plugins/hyperpowers-skills.ts
```

### 3. Restart OpenCode

Restart OpenCode. The plugin will automatically discover skills from the cloned directory.

You should see hyperpowers skills when you type `/brainstorm`, `/write-plan`, `/beads-triage`, etc.

## Usage

### Finding Skills

List all available hyperpowers skills:

```bash
# This shows all discovered skills
```

### Using Skills

Skills are auto-discovered from `~/.config/opencode/hyperpowers/.opencode/skills/`:

```bash
# Use brainstorming skill
/brainstorm [topic]

# Use writing-plans skill
/write-plan [feature description]

# Use executing-plans skill
/execute-plan
```

### Personal Skills

Create your own skills in `~/.config/opencode/skills/`:

```bash
mkdir -p ~/.config/opencode/skills/my-skill
```

Create `~/.config/opencode/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Use when [condition] - [what it does]
---

# My Skill

[Your skill content here]
```

**Skill Priority:**
- `project:skill-name` - Force project skill lookup
- `skill-name` - Searches project → personal → hyperpowers
- `hyperpowers:skill-name` - Force hyperpowers skill lookup

### Project Skills

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

**Skill Priority:** Project skills override personal skills, which override hyperpowers skills.

## Available Skills

### Workflow Skills

- **brainstorming** - Interactive design refinement using Socratic method
- **writing-plans** - Create detailed implementation plans with bite-sized tasks
- **executing-plans** - Execute plans in batches with review checkpoints
- **refactoring-safely** - Test-preserving transformations in small steps
- **test-driven-development** - RED-GREEN-REFACTOR cycle for implementation
- **verification-before-completion** - Evidence before claiming work complete
- **debugging-with-tools** - Systematic debugging using tools before fixes
- **fixing-bugs** - Complete workflow from discovery to closure
- **root-cause-tracing** - Trace bugs backward through call stack
- **finishing-a-development-branch** - Close epic, present integration options

### Quality & Review Skills

- **analyzing-test-effectiveness** - Audit test quality with Google Fellow SRE scrutiny
- **review-implementation** - Verify implementation against bd spec
- **testing-anti-patterns** - Prevent tautological tests, coverage gaming

### Advanced Operations

- **managing-bd-tasks** - Splitting, merging, dependencies, metrics for bd tasks
- **sre-task-refinement** - Apply Opus 4.1 corner-case analysis to tasks
- **dispatching-parallel-agents** - Launch multiple Claude agents for independent failures
- **debugging-with-tools** - Systematic investigation before fixes
- **brainstorming** - Socratic questioning for requirements refinement
- **using-hyper** - Mandatory skill-first workflow (meta-skill)

### Specialized Skills

- **skills-auto-activation** - Hooks for deterministic skill activation
- **building-hooks** - Create custom OpenCode hooks progressively
- **writing-skills** - TDD for documentation (test with subagents before writing)

## Commands

All hyperpowers commands are auto-discovered from the cloned repository:

- `/brainstorm` - Interactive design refinement
- `/write-plan` - Create implementation plan
- `/execute-plan` - Execute plan with checkpoints
- `/analyze-tests` - Audit test quality
- `/review-implementation` - Verify implementation fidelity
- `/beads-triage` - Run `bv --robot-triage` and return raw JSON

## Beads triage

`/beads-triage [optional args]` runs `bv --robot-triage` and returns raw JSON only. If `bv` is missing, the skill installs it using the official install script before running triage.

## Updating

```bash
cd ~/.config/opencode/hyperpowers
git pull
```

## Troubleshooting

### Plugin not loading

1. Check symlink exists: `ls -la ~/.config/opencode/plugins/`
2. Check OpenCode logs for errors
3. Verify Node.js is installed: `node --version`

### Skills not found

1. Verify skills directory exists: `ls ~/.config/opencode/hyperpowers/.opencode/skills/`
2. Check each skill has `SKILL.md` file
3. Use command name to test discovery

### Commands not found

1. Verify commands directory exists: `ls ~/.config/opencode/hyperpowers/.opencode/commands/`
2. Check each command is valid markdown with YAML frontmatter

## Getting Help

- Report issues: https://github.com/dpolishuk/hyperpowers/issues
- Documentation: https://github.com/dpolishuk/hyperpowers
