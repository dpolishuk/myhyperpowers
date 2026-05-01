# XPowers for Gemini CLI

Welcome to xpowers - a structured development workflow system for Gemini CLI. This extension brings the proven development patterns from xpowers to your Gemini CLI sessions.

## What is XPowers?

XPowers is a workflow system that provides:
- **Skills**: Reusable workflow definitions (TDD, brainstorming, planning, etc.)
- **Agents**: Specialized sub-agents for specific tasks (test-runner, code-reviewer, etc.)
- **Task Management**: `tm` for local task management with optional Linear sync

## Quick Start

### Slash Commands

Use these commands to quickly access xpowers workflows:

- `/xpowers:brainstorm` - Start refining an idea into a design
- `/xpowers:write-plan` - Create detailed implementation plans
- `/xpowers:execute-plan` - Execute plans iteratively
- `/xpowers:review-implementation` - Review code against requirements
- `/xpowers:tm-linear-setup` - Show the Gemini tm/Linear setup path for this branch

### Using Skills

Skills are available through Gemini’s extension skill system. When you need structured guidance, invoke the appropriate skill:

1. **brainstorming** - Turn rough ideas into validated designs
2. **writing-plans** - Create detailed implementation plans
3. **test-driven-development** - RED-GREEN-REFACTOR cycle
4. **executing-plans** - Execute tasks iteratively
5. **review-implementation** - Verify implementations
6. **fixing-bugs** - Complete bug fix workflow
7. **refactoring-safely** - Test-preserving transformations
8. **sre-task-refinement** - Apply Google Fellow SRE scrutiny
9. **verification-before-completion** - Evidence before claims

### Using Agents

Specialized agents can be invoked for specific tasks:

- **test-runner** - Run tests without context pollution
- **code-reviewer** - Review implementations
- **codebase-investigator** - Understand codebase state
- **internet-researcher** - Research APIs and libraries
- **autonomous-reviewer** - Final validation with web research

### Task Management with tm

The installed Gemini extension provides a tm-oriented task-management surface for this branch:

- `tm ready` - Find available work
- `tm show <id>` - View issue details
- `tm list --parent <epic-id>` - List child work
- `tm update <id> --status in_progress` - Claim work
- `tm close <id>` - Complete work
- `tm sync` - Push local work to Linear when configured

Preferred setup path on this branch:

```bash
git clone https://github.com/dpolishuk/xpowers.git
cd xpowers
./scripts/install.sh --gemini

export LINEAR_API_KEY="lin_api_your_key_here"
export LINEAR_TEAM_KEY="ENG"

~/.local/bin/tm --help
tm sync
```

## Workflow Pattern

The typical xpowers workflow:

1. **Brainstorm** - Use `/xpowers:brainstorm` or the brainstorming skill to refine ideas
2. **Plan** - Use `/xpowers:write-plan` to create detailed implementation plans
3. **Refine** - Run SRE refinement on tasks before execution
4. **Execute** - Use `/xpowers:execute-plan` or TDD skill to implement
5. **Review** - Use `/xpowers:review-implementation` for validation
6. **Verify** - Run verification-before-completion gates
7. **Complete** - Close tasks and epic

## Anti-Patterns (NEVER DO)

- ❌ Skip SRE refinement before executing tasks
- ❌ Skip tests in TDD (RED must fail first)
- ❌ Skip verification gates
- ❌ Work directly on main (always use feature branches)
- ❌ Bypass tm/bd CLI for issue tracking (never read .beads/issues.jsonl directly)
- ❌ Duplicate skill content (use symlinks)

## Configuration

Settings are resolved by extension startup and environment:

- `TM_PATH`: Path to tm executable (default: `~/.local/bin/tm` when present, otherwise `tm`)
- `BD_PATH`: Path to bd executable (default: `bd`, legacy compatibility)
- `SKILLS_PATH`: Path to skills directory (default: extension-local `skills` target)
- `AGENTS_PATH`: Path to agents directory (default: extension-local `agents` target; `AGENTS_PATH` env overrides this, with workspace `agents/` as fallback)

## Learn More

- Skills are in `./skills/*/SKILL.md`
- Agents are in `./agents/*.md`
- Commands are in `./commands/<namespace>/*.toml`

Happy coding with structured workflows!
