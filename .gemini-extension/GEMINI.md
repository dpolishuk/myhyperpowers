# Hyperpowers for Gemini CLI

Welcome to hyperpowers - a structured development workflow system for Gemini CLI. This extension brings the proven development patterns from hyperpowers to your Gemini CLI sessions.

## What is Hyperpowers?

Hyperpowers is a workflow system that provides:
- **Skills**: Reusable workflow definitions (TDD, brainstorming, planning, etc.)
- **Agents**: Specialized sub-agents for specific tasks (test-runner, code-reviewer, etc.)
- **Issue Tracking**: bd (beads) CLI for tracking work with git integration

## Quick Start

### Slash Commands

Use these commands to quickly access hyperpowers workflows:

- `/hyperpowers:brainstorm` - Start refining an idea into a design
- `/hyperpowers:write-plan` - Create detailed implementation plans
- `/hyperpowers:execute-plan` - Execute plans iteratively
- `/hyperpowers:review-implementation` - Review code against requirements

### Using Skills

Skills are available as tools. When you need structured guidance, invoke the appropriate skill:

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

### Issue Tracking with bd

The bd (beads) integration provides:

- `bd ready` - Find available work
- `bd show <id>` - View issue details
- `bd update <id> --status in_progress` - Claim work
- `bd close <id>` - Complete work

## Workflow Pattern

The typical hyperpowers workflow:

1. **Brainstorm** - Use `/hyperpowers:brainstorm` or the brainstorming skill to refine ideas
2. **Plan** - Use `/hyperpowers:write-plan` to create detailed implementation plans
3. **Refine** - Run SRE refinement on tasks before execution
4. **Execute** - Use `/hyperpowers:execute-plan` or TDD skill to implement
5. **Review** - Use `/hyperpowers:review-implementation` for validation
6. **Verify** - Run verification-before-completion gates
7. **Complete** - Close tasks and epic

## Anti-Patterns (NEVER DO)

- ❌ Skip SRE refinement before executing tasks
- ❌ Skip tests in TDD (RED must fail first)
- ❌ Skip verification gates
- ❌ Work directly on main (always use feature branches)
- ❌ Bypass bd CLI for issue tracking (never read .beads/issues.jsonl directly)
- ❌ Duplicate skill content (use symlinks)

## Configuration

Settings are resolved by extension startup and environment:

- `BD_PATH`: Path to bd executable (default: `bd`)
- `SKILLS_PATH`: Path to skills directory (default: extension-local `skills` target)
- `AGENTS_PATH`: Path to agents directory (default: extension-local `agents` target; `AGENTS_PATH` env overrides this, with workspace `agents/` as fallback)

## Learn More

- Skills are in `./skills/*/SKILL.md`
- Agents are in `./agents/*.md`
- Commands are in `./commands/<namespace>/*.toml`

Happy coding with structured workflows!
