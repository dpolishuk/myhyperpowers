# Hyperpowers

Strong guidance for Claude Code as a software development assistant.

Hyperpowers is a Claude Code plugin that provides structured workflows, best practices, and specialized agents to help you build software more effectively. Think of it as a pair programming partner that ensures you follow proven development patterns.

## Features

### Skills

Reusable workflows for common development tasks:

**Feature Development:**
- **brainstorming** - Interactive design refinement using Socratic method
- **writing-plans** - Create detailed implementation plans (single task or multiple tasks)
- **executing-plans** - Execute tasks continuously with optional per-task review
- **review-implementation** - Verify implementation matches requirements
- **finishing-a-development-branch** - Complete workflow for PR creation and cleanup
- **sre-task-refinement** - Ensure all corner cases and requirements are understood (uses Opus 4.1)

**Bug Fixing & Debugging:**
- **debugging-with-tools** - Systematic investigation using debuggers, internet research, and agents
- **root-cause-tracing** - Trace backward through call stack to find original trigger
- **fixing-bugs** - Complete workflow from bug discovery to closure with bd tracking

**Refactoring & Maintenance:**
- **refactoring-safely** - Test-preserving transformations in small steps with tests staying green

**Quality & Testing:**
- **test-driven-development** - Write tests first, ensure they fail, then implement
- **testing-anti-patterns** - Prevent common testing mistakes
- **verification-before-completion** - Always verify before claiming success

**Task & Project Management:**
- **managing-bd-tasks** - Advanced bd operations: splitting tasks, merging duplicates, dependencies, metrics

**Collaboration & Process:**
- **dispatching-parallel-agents** - Investigate independent failures concurrently
- **writing-skills** - TDD for process documentation itself

**Infrastructure & Customization:**
- **building-hooks** - Create custom hooks for automating quality checks and workflow enhancements
- **skills-auto-activation** - Solve skills not activating reliably through better descriptions or custom hooks

### Slash Commands

Quick access to key workflows:

- `/hyperpowers:brainstorm` - Start interactive design refinement
- `/hyperpowers:write-plan` - Create detailed implementation plan
- `/hyperpowers:execute-plan` - Execute plan with review checkpoints
- `/hyperpowers:review-implementation` - Review completed implementation

### Specialized Agents

Domain-specific agents for complex tasks:

- **code-reviewer** - Review implementations against plans and coding standards
- **codebase-investigator** - Understand current codebase state and patterns
- **internet-researcher** - Research APIs, libraries, and current best practices
- **test-runner** - Run tests/pre-commit hooks/commits without context pollution

### Model Configuration

All agents are configured with `model: inherit`, meaning they respect your current model choice in OpenCode or Claude Code settings. This gives you full control over which models each agent uses.

**Recommended model choices by agent:**

| Agent | Recommended Model | Reason |
|-------|------------------|--------|
| test-runner | Fast model (glm-4.5, haiku) | High-volume, low-complexity tasks |
| codebase-investigator | Fast model | Scanning and searching operations |
| internet-researcher | Fast model | External API lookups and summarization |
| code-reviewer | Capable model (sonnet, glm-4.7) | Requires reasoning and analysis |
| test-effectiveness-analyst | Capable model (sonnet, glm-4.7) | Complex analysis of test quality |

**To customize agent models:**

1. **OpenCode:** Edit `opencode.json` in your project:
   ```json
   {
     "model": "provider/glm-4.7",
     "agents": {
       "test-runner": {
         "model": "provider/glm-4.5"
       }
     }
   }
   ```

2. **Claude Code:** Set your preferred model in settings, or edit agent frontmatter in `.opencode/agents/*.md`:
   ```yaml
   ---
   model: glm-4.5
   mode: subagent
   ---
   ```

### Hooks System

Intelligent hooks that provide context-aware assistance:

**Automatic Skill Activation** - The UserPromptSubmit hook analyzes your prompts and suggests relevant skills before Claude responds. Simply type what you want to do, and you'll get skill recommendations if applicable.

**Context Tracking** - The PostToolUse hook tracks file edits during your session, maintaining context for intelligent reminders.

**Gentle Reminders** - The Stop hook provides helpful reminders after Claude responds:
- 💭 TDD reminder when editing source without tests
- ✅ Verification reminder when claiming completion
- 💾 Commit reminder after multiple file edits

See [HOOKS.md](HOOKS.md) for configuration, troubleshooting, and customization details.

## Key Benefits

### Context Efficiency with test-runner Agent

The **test-runner** agent solves a common problem: running tests, pre-commit hooks, or git commits can generate massive amounts of output that pollutes your context window with successful test results, formatting changes, and debug prints.

**How it works:**
- Agent runs commands in its own separate context
- Captures all output (test results, hook output, etc.)
- Returns **only**: summary statistics + complete failure details
- Filters out: passing test output, "Reformatted X files" spam, verbose formatting diffs

**Example:**
```bash
# Without agent: Your context gets 500 lines of passing test output
pytest tests/  # 47 tests pass, prints everything

# With test-runner agent: Your context gets clean summary
Task("Run tests", "Run pytest tests/")
# Agent returns: "✓ 47 tests passed, 0 failed. Exit code 0."
```

**Benefits:**
- Keeps your context clean and focused
- Still provides complete failure details when tests fail
- Works with all test frameworks (pytest, cargo, npm, go)
- Handles pre-commit hooks without formatting spam
- Provides verification evidence for verification-before-completion skill

## Installation

### OpenCode

Hyperpowers includes first-class OpenCode integration (commands, agents, skills, and a safety plugin).

**Option A: Use Hyperpowers in this repo (recommended for contributors)**

1. Install OpenCode.
2. Run OpenCode from the repo root (so it discovers `opencode.json` and `.opencode/`):

```bash
opencode
```

This enables:
- Commands from `.opencode/commands/*.md` (invoked as `/<command>`, e.g. `/brainstorm`)
- Agents from `.opencode/agents/*.md` (e.g. `@code-reviewer`, `@test-runner`)
- Skills via local skill discovery from `.opencode/skills/`
- Safety guardrails plugin from `.opencode/plugins/hyperpowers-safety.ts`

**Verify in OpenCode:**
- Type `/brainstorm` and confirm OpenCode expands the prompt from `.opencode/commands/brainstorm.md`
- Invoke an agent like `@code-reviewer` and confirm it runs in subagent mode
- Verify skills tools exist by running any Hyperpowers command (they reference tools like `skills_hyperpowers_brainstorming`)
- Optional safety check: try reading `.env` (it should be blocked by the safety plugin)

**Option B: Install locally (no OpenCode plugin installs)**

This is the fully local path: no `"plugin": [...]` in `opencode.json`.

1. Copy `opencode.json` and the `.opencode/` directory into your project.
2. Install plugin dependencies locally:

```bash
cd .opencode
bun install
cd ..
```

3. Start OpenCode from the project root:

```bash
opencode
```

Notes:
- Skill tools are provided by the local skills loader plugin: `.opencode/plugins/hyperpowers-skills.ts`.
- Safety guardrails are provided by: `.opencode/plugins/hyperpowers-safety.ts`.
- `bun install` downloads dependencies (e.g. `@opencode-ai/plugin`, `gray-matter`, `zod`) but does not require installing any OpenCode plugins via npm.

**Portability:** `.opencode/plugins/hyperpowers-safety.ts` and `.opencode/plugins/hyperpowers-skills.ts` are self-contained, so copying `.opencode/` to another repo works.

**Option C: Install the safety plugin into any OpenCode project (npm)**

If you prefer a config-only install, add the plugin to your project's `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "@dpolishuk/hyperpowers-opencode"
  ]
}
```

Then restart OpenCode.

### Claude Code

**Option A: Local development** (load the plugin straight from this repo):

```text
claude --plugin-dir .
```

**Option B: Install from local path** (add marketplace, then install plugin):

```text
# Add your local clone as a marketplace (use the actual absolute path)
/plugin marketplace add /Users/your-username/work/hyperpowers

# Install from the marketplace you just added
/plugin install myhyperpowers@myhyperpowers --scope user
```

**Option C: Install from GitHub** (requires marketplace published to GitHub):

```text
# Add GitHub repo as marketplace
/plugin marketplace add dpolishuk/myhyperpowers

# Install from the marketplace
/plugin install myhyperpowers@myhyperpowers --scope user
```

**Note:** The format is `marketplace-name@plugin-name`. In this case both are `myhyperpowers`.

**Scopes:** Use `--scope project` or `--scope local` if you want the install scoped to a project or a single session.

**Verify:** Run `/help` - you should see Hyperpowers slash commands listed.

**Update later:**

```text
/plugin update myhyperpowers@myhyperpowers
```

**Migrating from legacy names:**

```text
/plugin uninstall hyperpowers@hyperpowers
/plugin uninstall withzombies-hyper@withzombies-hyper
/plugin install myhyperpowers@myhyperpowers --scope user
```

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

[Creates detailed plan with specific tasks in bd]

Claude: I'm using the executing-plans skill to implement the tasks.

[Works through ready tasks continuously, using bd ready to find next task]

Claude: I'm using the test-runner agent to verify all tests pass.

[Agent runs tests, reports: "✓ 47 tests passed, 0 failed"]

Claude: I'm using the review-implementation skill to verify everything works.

[Reviews implementation against requirements]

Claude: I'm using the finishing-a-development-branch skill to wrap up.

[Creates PR, cleans up]
```

## Philosophy

Hyperpowers embodies several core principles:

- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study patterns before implementing
- **Explicit workflows over implicit assumptions** - Make the process visible
- **Verification before completion** - Evidence over assertions
- **Test-driven when possible** - Red, green, refactor

## Contributing

Contributions are welcome! This plugin is inspired by [obra/superpowers](https://github.com/obra/superpowers).

### Adding New Skills

1. Create a new directory in `skills/`
2. Add a `skill.md` file with the workflow
3. Follow the TDD approach in `writing-skills` skill
4. Test with subagents before deployment

## License

MIT

## Author

Ryan Stortz (ryan@withzombies.com)

## Acknowledgments

Inspired by [obra/superpowers](https://github.com/obra/superpowers) - a strong foundation for structured development workflows
