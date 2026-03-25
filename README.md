# Hyperpowers

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.12.1-green.svg)](.claude-plugin/plugin.json)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Plugin-blueviolet.svg)](https://claude.ai/code)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/dpolishuk/myhyperpowers/pulls)

Strong guidance for Claude Code, OpenCode, and Gemini CLI as software development assistants. Think of it as a pair programming partner that ensures you follow proven development patterns.

[Features](#features) · [Installation](#installation) · [Linear Integration](#linear-integration-optional) · [Uninstall](#uninstall) · [Usage](#usage) · [Philosophy](#philosophy) · [Contributing](#contributing)

## Quick Start

**Claude Code** (recommended):

```text
/plugin marketplace add dpolishuk/myhyperpowers
/plugin install myhyperpowers@myhyperpowers --scope user
```

See [Installation](#installation) for OpenCode, Gemini CLI, and Codex CLI.

## Task Management Model

Hyperpowers is **tm-first** on this branch. `tm` is the **canonical user-facing task-management interface** for everyday setup, task work, and sync workflows.

These tools are related, but `bd` / `br` / `tk` are **not interchangeable day-to-day commands**:

- `tm` = canonical user-facing task-management interface
- `bd` = current local tracker backend in this repo
- `br` = Beads Rust, a classic SQLite+JSONL beads-compatible backend / migration option
- `tk` = Ticket, a git-backed markdown ticket workflow alternative

Linear and GitHub are integrations layered on top of task management — **Linear and GitHub are integrations**, not primary local task trackers.

If you only want the main working model:

1. install the host support you need
2. use `tm` for day-to-day work
3. use deeper guides for backend or integration details

Start here:
- [Installation](#installation)
- [Linear Integration](#linear-integration-optional)
- [docs/README.md](docs/README.md)

## Features

### Skills

Reusable workflows for common development tasks:

#### Feature Development

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **brainstorming** | Interactive design refinement using Socratic questioning | Before writing any code |
| **writing-plans** | Create detailed implementation plans with specific tasks | After brainstorming, before coding |
| **executing-plans** | Execute tasks iteratively with user checkpoint reviews | When you want review between tasks |
| **execute-ralph** | Execute entire epics autonomously without stopping | For well-defined epics you trust |
| **review-implementation** | Verify implementation matches requirements | After completing tasks |
| **finishing-a-development-branch** | Complete workflow for PR creation and cleanup | When feature is complete |
| **sre-task-refinement** | Review plans with Google Fellow SRE scrutiny | Before starting implementation |

#### Bug Fixing & Debugging

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **debugging-with-tools** | Systematic investigation using debuggers and agents | When tests fail or bugs appear |
| **root-cause-tracing** | Trace backward through call stack to find original trigger | When errors occur deep in execution |
| **fixing-bugs** | Complete workflow from discovery to closure | For any bug fix |

#### Quality & Testing

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **test-driven-development** | RED-GREEN-REFACTOR cycle enforcement | Writing new features or fixes |
| **testing-anti-patterns** | Prevent common testing mistakes | When writing tests with mocks |
| **analyzing-test-effectiveness** | Audit tests with SRE scrutiny (finds tautologies, coverage gaming) | When coverage is high but bugs still slip through |
| **verification-before-completion** | Always verify before claiming success | Before saying "done" |

#### Refactoring & Maintenance

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **refactoring-diagnosis** | Identify code/design smells and refactor targets | When code quality risk is increasing |
| **refactoring-design** | Plan safe refactors with composition and test strategy | Before large structural code changes |
| **refactoring-safely** | Test-preserving transformations | When refactoring existing code |
| **managing-bd-tasks** | Advanced operations: splitting, merging, dependencies, metrics | Complex project management |

#### Collaboration & Process

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **dispatching-parallel-agents** | Investigate 3+ independent failures concurrently | Multiple unrelated failures |
| **writing-skills** | TDD for process documentation | Creating new skills |
| **building-hooks** | Create custom automation hooks | Extending IDE behavior |
| **skills-auto-activation** | Fix skills not activating reliably | Troubleshooting skill discovery |

### Slash Commands

```
/hyperpowers:brainstorm          - Start interactive design refinement
/hyperpowers:write-plan          - Create detailed implementation plan
/hyperpowers:execute-plan        - Execute plan with review checkpoints
/hyperpowers:execute-ralph       - Execute epic autonomously (no stops)
/hyperpowers:review-implementation - Review completed work
/hyperpowers:refactor-diagnose   - Diagnose code/design smells and refactor targets
/hyperpowers:refactor-design     - Design refactor with composition, DI, and test strategy
/hyperpowers:refactor-execute    - Execute refactor safely with tests staying green
/hyperpowers:analyze-tests       - Audit test effectiveness
/hyperpowers:version             - Show plugin version
```

### Specialized Agents

Domain-specific agents dispatched via the `Task` tool:

#### Core Execution Agents

| Agent | Purpose | Model | Use Case |
|-------|---------|-------|----------|
| **test-runner** | Run tests/commits without polluting context | Fast (haiku, glm-4.5) | High-volume, low-complexity verification |
| **codebase-investigator** | Understand codebase state and patterns | Fast | Finding existing patterns, locating code |
| **internet-researcher** | Research APIs, libraries, best practices | Fast | External documentation lookup |
| **code-reviewer** | Review implementations against plans | Capable (sonnet, glm-4.7) | Implementation quality review |

#### Multi-Agent Review Suite (Used by Ralph)

These 5 agents run in parallel after each task during autonomous execution:

| Agent | Focus Area | What They Find |
|-------|------------|----------------|
| **review-quality** | Bugs, security, race conditions, resource leaks | Logic errors, injection vulnerabilities, deadlocks |
| **review-implementation** | Requirements match, completeness, correctness | Missing features, partial implementations |
| **review-testing** | Coverage, test quality, edge cases | Untested code paths, weak assertions |
| **review-simplification** | Over-engineering, premature abstraction | Unnecessary complexity, dead code |
| **review-documentation** | Docs for API changes, config updates | Missing README updates, undocumented features |

#### Advanced Analysis Agents

| Agent | Purpose | Model | Specialization |
|-------|---------|-------|----------------|
| **test-effectiveness-analyst** | Audit test quality with SRE scrutiny | Capable | Identifies tautological tests, coverage gaming, weak assertions |
| **autonomous-reviewer** | Final validation with web research | Most capable (opus, glm-4.7) | Comprehensive review with external research |

See [Model Configuration](docs/model-configuration.md) for details on configuring AI providers and models per agent.

### Hooks System

Intelligent hooks that provide context-aware assistance:

- **Automatic Skill Activation** - The UserPromptSubmit hook analyzes prompts and suggests relevant skills.
- **Context Tracking** - The PostToolUse hook tracks file edits during your session.
- **Gentle Reminders** - The Stop hook provides TDD, verification, and commit reminders.

See [HOOKS.md](HOOKS.md) for configuration, troubleshooting, and customization details.

## How Ralph Works

**Ralph** (`execute-ralph`) is the autonomous execution mode that completes entire epics without user intervention.

```
Setup → Execute Task (TDD) → 5-Agent Review → Auto-Fix (max 2 tries) → Next Task → Final Review → Done
```

<details>
<summary><strong>Ralph's Execution Flow (detailed)</strong></summary>

```
PHASE 0: Setup
  ├── Smart triage (bv -robot-triage)
  ├── Create feature branch from epic name
  └── Load epic requirements and tasks

PHASE 1: Execute Task
  ├── Claim next ready task (bv -robot-next)
  ├── Implement using TDD skill
  └── Run tests via test-runner agent

PHASE 2: Multi-Agent Parallel Review
  ├── review-quality       → Bugs, security, race conditions
  ├── review-implementation → Requirements match
  ├── review-testing       → Coverage, test quality
  ├── review-simplification → Over-engineering detection
  └── review-documentation → Doc update needs

PHASE 3: Autonomous Fix (max 2 iterations)
  ├── If issues found: fix autonomously
  ├── Re-run affected reviewers only
  └── Still issues after 2 tries? Flag for user review

PHASE 4: Final Critical Review
  ├── review-quality (critical issues only)
  ├── review-implementation (critical gaps only)
  └── If issues: create remediation tasks and fix

PHASE 5: Complete
  ├── Close epic
  ├── Final commit
  └── Present comprehensive summary
```

</details>

### Ralph vs Execute-Plan

| Aspect | `/hyperpowers:execute-plan` | `/hyperpowers:execute-ralph` |
|--------|----------------------------|------------------------------|
| **User Interaction** | Stops after each task for review | Only stops on critical failure |
| **Review Points** | Final review only | Per-task (5 agents) + final (2 agents) |
| **Auto-Commit** | Manual | After every task |
| **Git Branch** | Manual | Auto-created from epic name |
| **Best For** | Uncertain requirements, high-risk changes | Well-defined epics, trusted execution |

**Use Ralph when** epics have clear success criteria and you trust autonomous execution.
**Don't use Ralph when** requirements are ambiguous or you want to review between tasks.

**Safety limits:** Max 2 fix iterations per task, max 3 remediation rounds, max 10 tasks per execution, auto-branch creation (never works on main), immutable epic requirements.

## Key Benefits

- **Context efficiency** - The test-runner agent keeps verbose output (test results, formatting diffs) in its own context, returning only summaries and failures to yours.
- **Structured workflows** - Skills enforce proven patterns: TDD, verification-before-completion, brainstorming-before-coding.
- **Multi-agent review** - Ralph's 5 specialized reviewers catch bugs, security issues, missing tests, and over-engineering in parallel.
- **Safe autonomous execution** - Ralph has hard limits on iterations, always creates feature branches, and never waters down epic requirements.

## Installation

<details>
<summary><strong>Claude Code</strong></summary>

**Recommended: Install from GitHub**

```text
/plugin marketplace add dpolishuk/myhyperpowers
/plugin install myhyperpowers@myhyperpowers --scope user
```

**Note for legacy installs:**

If you previously installed under the legacy name `withzombies-hyper`, uninstall it first:

```text
/plugin uninstall withzombies-hyper@withzombies-hyper
```

**Local development** (if you're contributing):

```text
claude --plugin-dir .
```

**From local clone:**

```text
/plugin marketplace add /absolute/path/to/hyperpowers
/plugin install myhyperpowers@myhyperpowers --scope user
```

**Migration from legacy plugin names:**

```text
/plugin uninstall withzombies-hyper@hyperpowers --scope user
/plugin uninstall hyperpowers@hyperpowers --scope user
/plugin install myhyperpowers@myhyperpowers --scope user
```

**Verify installation:**

```text
/help
# Should show /hyperpowers:* commands
```

</details>

<details>
<summary><strong>OpenCode</strong></summary>

Quick start - run from the hyperpowers repo:

```bash
# Clone or navigate to hyperpowers
cd /path/to/hyperpowers

# Preferred path on this branch: install OpenCode support + shared tm runtime
./scripts/install.sh --opencode

# Run OpenCode (it auto-discovers opencode.json and .opencode/)
opencode
```

That's it! Commands, agents, skills, and the shared `tm` CLI used by this branch are now available.

**For your own projects**, copy these files:

```bash
cp opencode.json your-project/
cp -r .opencode your-project/
cd your-project/.opencode && bun install && cd ..
opencode
```

**Install via npm** (alternative):

```json
// In your project's opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@dpolishuk/hyperpowers-opencode"]
}
```

This npm path adds the OpenCode plugin package only. For this branch's installer-first `tm` + Linear workflow, use `./scripts/install.sh --opencode` so the shared tm runtime is provisioned as well.

**Verify:** `/hyperpowers-version`

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

Preferred path on this branch:

```bash
./scripts/install.sh --gemini
```

Fallback manual extension flow:

```bash
# Install or link the extension only
gemini extensions install .gemini-extension

# Reinstall with auto-update enabled
gemini extensions install .gemini-extension --auto-update

# Development workflow (loads edits immediately)
gemini extensions link .gemini-extension
```

Manual extension install/link is fallback-only here: it does **not** provision the shared `tm` runtime used by this branch's `tm sync` + optional Linear support.

If you had a prior local install, uninstall first:

```bash
gemini extensions uninstall hyperpowers
```

Verify: `gemini extensions list && gemini tools`

For full extension-specific installation and troubleshooting, see `.gemini-extension/README.md`.

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

Use the unified installer to install wrappers to `~/.codex/skills` (auto-syncs if needed):

```bash
./scripts/install.sh --codex
```

Or install to all detected agents at once:

```bash
./scripts/install.sh --all
```

Explicit invocation in Codex uses skill names (not custom slash-command registration):

```text
$codex-command-write-plan Draft a plan for feature X.
$codex-command-execute-plan Execute task bd-123.
$codex-skill-executing-plans Continue from current tm ready task.
```

You can also use `/skills` in Codex UI to discover and select the same wrappers.

</details>

<details>
<summary><strong>After Installation: Configure Models</strong></summary>

All agents use `model: inherit` by default, meaning they follow your current model selection.

**Quick setup - copy an example config:**

```bash
# For Anthropic Claude
cp docs/opencode.example.anthropic.json opencode.json

# For GLM models
cp docs/opencode.example.glm.json opencode.json

# Or use the minimal inherit-based config
cp docs/opencode.example.inherit.json opencode.json
```

See [Model Configuration](docs/model-configuration.md) for full documentation.

</details>

<details>
<summary><strong>Troubleshooting</strong></summary>

**OpenCode:**

| Issue | Solution |
|-------|----------|
| Commands not found | Ensure you're running `opencode` from a directory with `opencode.json` |
| Agents not working | Check that `.opencode/agents/*.md` files exist and have valid YAML frontmatter |
| Skills not loading | Run `bun install` in `.opencode/` directory |

**Claude Code:**

| Issue | Solution |
|-------|----------|
| Commands not showing | Run `/plugin list` to verify installation |
| Plugin not loading | Check `~/.claude/plugins/` for `myhyperpowers@myhyperpowers` directory |
| Hooks not firing | Restart Claude Code after installation |

**Getting help:** Open an issue at https://github.com/dpolishuk/myhyperpowers/issues

**Updating:**

```text
# Claude Code
/plugin update myhyperpowers@myhyperpowers

# OpenCode: git pull in the hyperpowers directory
```

</details>

## Linear Integration (Optional)

Hyperpowers includes a `tm` CLI that wraps the local `bd` task manager. Without any configuration, `tm` passes everything through to `bd` — your existing workflow stays the same.

Optionally, you can connect `tm sync` to [Linear](https://linear.app) to mirror your local issues to your team's Linear workspace.

### Quick Setup

1. **Get a Linear API key**: Linear Settings -> API -> Personal API keys -> Create key
2. **Find your team key**: Linear Settings -> Teams -> your team's short key (e.g., "ENG")
3. **Configure**:

```bash
# Option A: Environment variables
export LINEAR_API_KEY="lin_api_your_key_here"
export LINEAR_TEAM_KEY="ENG"

# Option B: Persistent config (per-repo)
tm config set linear.api-key "lin_api_your_key_here"
tm config set linear.team-key "ENG"
```

4. **Sync**: `tm sync` now pushes issues to Linear after syncing git

### Without Linear

If you don't configure Linear, everything works as before:

```
tm ready       →  bd ready
tm show bd-42  →  bd show bd-42
tm sync        →  bd sync (git only)
```

### Linear MCP Server (Optional)

For OpenCode, add a Linear MCP server to your project-root `opencode.json`:

```json
{
  "mcp": {
    "linear": {
      "type": "local",
      "command": ["npx", "-y", "@tacticlaunch/mcp-linear@1.0.12"],
      "environment": { "LINEAR_API_KEY": "{env:LINEAR_API_KEY}" }
    }
  }
}
```

See [docs/linear-mcp-setup.md](docs/linear-mcp-setup.md) for the full setup guide with host-specific examples, field mapping, troubleshooting, and architecture details.

## Uninstall

Hyperpowers uses a manifest-based uninstaller that only removes files it installed -- your custom skills, agents, and hooks are safe.

```bash
# Preview what would be removed (no changes made)
./scripts/uninstall.sh --all --dry-run

# Uninstall from all agents
./scripts/uninstall.sh --all

# Uninstall from specific agent
./scripts/uninstall.sh --claude
./scripts/uninstall.sh --opencode
./scripts/uninstall.sh --kimi
./scripts/uninstall.sh --codex

# Complete removal (including backups and metadata)
./scripts/uninstall.sh --all --purge --yes
```

**Claude Code plugin:** `/plugin uninstall myhyperpowers@myhyperpowers --scope user`

See `./scripts/install.sh --help` for all options.

## Usage

### Getting Started

The `using-hyper` skill automatically loads at the start of each conversation and establishes core workflows. It ensures you:

1. Check for relevant skills before starting any task
2. Follow mandatory workflows (brainstorming before coding, TDD, verification)
3. Use TodoWrite for tracking checklist items
4. Announce which skills you're using

### Example Workflow

```
User: I need to add user authentication to my app

Claude: I'm using the brainstorming skill to refine your authentication requirements.
[Socratic questioning to understand requirements]

Claude: Now I'm using the writing-plans skill to create a detailed implementation plan.
[Creates detailed plan with specific tasks in tm-backed tracking]

Claude: I'm using the executing-plans skill to implement the tasks.
[Works through ready tasks continuously, using tm ready to find next task]

Claude: I'm using the test-runner agent to verify all tests pass.
[Agent runs tests, reports: "47 tests passed, 0 failed"]

Claude: I'm using the review-implementation skill to verify everything works.
[Reviews implementation against requirements]

Claude: I'm using the finishing-a-development-branch skill to wrap up.
[Creates PR, cleans up]
```

### Example: Using Ralph for Autonomous Execution

```
User: /hyperpowers:execute-ralph

Claude: I'll execute the current epic autonomously with continuous review.
[Creates feature branch]
[Executes Task 1 with TDD]
[5 review agents analyze Task 1]
[Fixes 2 minor issues autonomously]
[Commits Task 1]
[Executes Task 2...]
...
[Final critical review]
[Closes epic]

Claude: Epic complete! Summary:
- Branch: feature/user-authentication
- Tasks completed: 5
- Commits: 7 (including 2 fix commits)
- Review iterations: 2
- All success criteria met
```

## Philosophy

Hyperpowers embodies several core principles:

- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study patterns before implementing
- **Explicit workflows over implicit assumptions** - Make the process visible
- **Verification before completion** - Evidence over assertions
- **Test-driven when possible** - Red, green, refactor
- **Autonomous execution with guardrails** - Trust but verify with multi-agent review

## Contributing

Contributions are welcome! This plugin is inspired by [obra/superpowers](https://github.com/obra/superpowers).

### Adding New Skills

1. Create a new directory in `skills/`
2. Add a `SKILL.md` file with the workflow
3. Follow the TDD approach in `writing-skills` skill
4. Test with subagents before deployment

### Adding New Agents

1. Create `agents/<agent-name>.md` with YAML frontmatter
2. Include `name`, `description`, and `model` fields
3. Document the agent's purpose and usage patterns

### Codex Skill Sync Pipeline

Codex-compatible wrappers are generated artifacts. The source of truth remains:

- `skills/*/SKILL.md`
- `commands/*.md`
- `agents/*.md`

Generated output is written to `.agents/skills` (in this repo that path is a symlink to `.kimi/skills`).

Run these commands after changing skills/commands/agents:

```bash
# Regenerate codex wrappers
node scripts/sync-codex-skills.js --write

# Verify generated wrappers are up to date (CI-friendly)
node scripts/sync-codex-skills.js --check
```

Description quality is validated during both `--write` and `--check`:

- Minimum quality bar: at least 20 characters and 5 words.
- Trigger/boundary wording required (for example: `use when`, `use to`, `if`, `before`, `after`, `do not`).
- Vague wording such as `helper`, `generic`, `misc`, or `stuff` is rejected.

Do not hand-edit generated `codex-*` skill directories; they are overwritten by sync.

### Unified Installer

All agents can be installed using the unified installer:

```bash
./scripts/install.sh --all        # Install to all detected agents
./scripts/install.sh --status     # Show install state per agent
./scripts/install.sh --help       # Full usage with all flags
./scripts/install.sh --uninstall --all  # Remove from all agents
```

Install to specific agents:

```bash
./scripts/install.sh --claude     # Claude Code only
./scripts/install.sh --opencode   # OpenCode only
./scripts/install.sh --kimi       # Kimi CLI only
./scripts/install.sh --codex      # Codex CLI only
./scripts/install.sh --gemini     # Gemini CLI only
```

Installer behavior:
- Auto-detects which agents are installed on the system.
- Backs up existing installs before overwriting (keeps 3 most recent).
- Validates each install (skill counts, hook structure, version).
- Reports partial failures -- if one agent fails, others still install.

For agent-specific setup guides, see `.opencode/INSTALL.md`, `.kimi/INSTALL.md`, and `.codex/INSTALL.md`.

## License

MIT

## Author

Ryan Stortz (ryan@withzombies.com) and Dmitry Polishuk

## Acknowledgments

Inspired by [obra/superpowers](https://github.com/obra/superpowers) - a strong foundation for structured development workflows
