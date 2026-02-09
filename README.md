# Hyperpowers

Strong guidance for Claude Code and OpenCode as software development assistants.

Hyperpowers is a plugin that provides structured workflows, best practices, and specialized agents to help you build software more effectively. Think of it as a pair programming partner that ensures you follow proven development patterns.

## Table of Contents

- [Features](#features)
  - [Skills](#skills)
  - [Slash Commands](#slash-commands)
  - [Specialized Agents](#specialized-agents)
  - [Model Configuration](#model-configuration)
- [How Ralph Works](#how-ralph-works)
- [Key Benefits](#key-benefits)
- [Installation](#installation)
- [Usage](#usage)
- [Philosophy](#philosophy)
- [Contributing](#contributing)

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

Quick access to key workflows:

```
/hyperpowers:brainstorm          - Start interactive design refinement
/hyperpowers:write-plan          - Create detailed implementation plan
/hyperpowers:execute-plan        - Execute plan with checkpoint reviews
/hyperpowers:execute-ralph       - Execute epic autonomously (no stops)
/hyperpowers:review-implementation - Review completed work
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

### Model Configuration

Hyperpowers agents support per-agent model configuration using the `providerID/modelID` format. This allows you to:
- Use different models for different agents (e.g., fast models for test-running, capable models for code review)
- Configure multiple API providers simultaneously
- Optimize costs by matching task complexity to model capability

**Recommended model choices by agent:**

| Agent | Recommended Model | Reason |
|-------|------------------|--------|
| test-runner | Fast model (haiku, glm-4.5) | High-volume, low-complexity tasks |
| codebase-investigator | Fast model | Scanning and searching operations |
| internet-researcher | Fast model | External API lookups and summarization |
| code-reviewer | Capable model (sonnet, glm-4.7) | Requires reasoning and analysis |
| test-effectiveness-analyst | Capable model (sonnet, glm-4.7) | Complex analysis of test quality |
| autonomous-reviewer | Most capable model (opus, glm-4.7) | Final validation and comprehensive review |

---

#### Understanding the `providerID/modelID` Format

OpenCode uses a `providerID/modelID` format to specify exactly which provider and model to use:

```
anthropic/claude-sonnet-4-5
├───┬───┘ └───┬───────────┘
│   │         └── Model ID
│   └── Provider ID
└── Separator (forward slash)
```

This format eliminates ambiguity when multiple providers offer models with similar names.

---

#### Configuration Methods

There are three ways to configure agent models, in order of precedence:

1. **Agent Frontmatter** - Set default model in the agent definition
2. **OpenCode Config** - Override per-agent models in `opencode.json`
3. **Environment Variables** - Dynamic configuration via env vars

---

##### Method 1: Agent Frontmatter (Default Configuration)

Each agent file has a YAML frontmatter section where you can specify the default model:

**File locations:**
- Claude Code: `agents/<agent-name>.md`
- OpenCode: `.opencode/agents/<agent-name>.md`

**Format:**

```yaml
---
name: test-runner
description: Runs tests without polluting context
model: anthropic/claude-haiku-4-5  # Full providerID/modelID format
---
```

**Supported model values:**

| Value | Description | Example |
|-------|-------------|---------|
| `inherit` | Use the parent's/current model | `model: inherit` |
| `providerID/modelID` | Explicit provider and model | `model: anthropic/claude-sonnet-4-5` |
| `modelID` (OpenCode only) | Shorthand for built-in providers | `model: claude-sonnet-4-5` |

**Example agent configurations:**

```yaml
# agents/test-runner.md - Use fast, cheap model
---
name: test-runner
model: anthropic/claude-haiku-4-5
---
```

```yaml
# agents/code-reviewer.md - Use capable model
---
name: code-reviewer
model: anthropic/claude-sonnet-4-5
---
```

```yaml
# agents/autonomous-reviewer.md - Use most capable model
---
name: autonomous-reviewer
model: anthropic/claude-opus-4-5
---
```

---

##### Method 2: OpenCode Configuration (Per-Agent Override)

In OpenCode, you can override agent models in your `opencode.json` file without modifying agent files. This is useful for:
- Project-specific model choices
- Testing different models
- User preferences that shouldn't be committed

**Configuration precedence (highest to lowest):**

```
1. opencode.json → agents.<agent-name>.model
2. opencode.json → model (top-level default)
3. Agent frontmatter → model setting
4. Provider default
```

**Basic configuration:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "comment": "All agents use Sonnet by default",
  "model": "anthropic/claude-sonnet-4-5"
}
```

**Per-agent override:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "comment": "Optimize costs: fast models for simple tasks, capable for complex",
  "model": "anthropic/claude-sonnet-4-5",
  "agents": {
    "test-runner": {
      "model": "anthropic/claude-haiku-4-5"
    },
    "codebase-investigator": {
      "model": "anthropic/claude-haiku-4-5"
    },
    "autonomous-reviewer": {
      "model": "anthropic/claude-opus-4-5"
    }
  }
}
```

---

##### Method 3: Multiple Providers with Same Models

When using multiple providers (e.g., multiple API proxies or aggregation services), use the full `providerID/modelID` format to disambiguate:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "comment": "Configure multiple providers with same model names",
  
  "model": "proxy1/claude-sonnet-4-5",
  "small_model": "proxy1/claude-haiku-4-5",
  
  "provider": {
    "proxy1": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "API Proxy 1",
      "options": {
        "baseURL": "https://api.proxy1.com/v1",
        "apiKey": "{env:PROXY1_API_KEY}"
      },
      "models": {
        "claude-sonnet-4-5": {
          "name": "Claude Sonnet 4.5 (via Proxy 1)",
          "limit": { "context": 200000, "output": 64000 }
        },
        "claude-haiku-4-5": {
          "name": "Claude Haiku 4.5 (via Proxy 1)",
          "limit": { "context": 200000, "output": 8192 }
        }
      }
    },
    "proxy2": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "API Proxy 2",
      "options": {
        "baseURL": "https://api.proxy2.com/v1",
        "apiKey": "{env:PROXY2_API_KEY}"
      },
      "models": {
        "claude-sonnet-4-5": {
          "name": "Claude Sonnet 4.5 (via Proxy 2)",
          "limit": { "context": 200000, "output": 64000 }
        }
      }
    },
    "anthropic": {
      "comment": "Official Anthropic provider",
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  },
  
  "agents": {
    "test-runner": {
      "model": "proxy2/claude-haiku-4-5"
    },
    "code-reviewer": {
      "model": "anthropic/claude-opus-4-5"
    }
  },
  
  "disabled_providers": ["openai", "google"]
}
```

**Key points for multi-provider setup:**

1. **Provider ID** must be unique (e.g., `proxy1`, `proxy2`, `anthropic`)
2. **Model IDs** are scoped to each provider - same name can exist in multiple providers
3. **Reference format** is always `providerID/modelID`
4. **Disable unused providers** to avoid confusion in model selection

---

##### Method 4: Claude Code Configuration

Claude Code uses a different configuration approach. Models are resolved through settings files:

**Global settings:** `~/.claude/settings.json`
**Project settings:** `.claude/settings.json`

**Configuration format:**

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_MODEL": "claude-sonnet-4-5",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5"
  }
}
```

**Using third-party providers (e.g., GLM, OpenRouter):**

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.glm.ai/v1",
    "ANTHROPIC_AUTH_TOKEN": "{env:GLM_API_KEY}",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7"
  }
}
```

**Note:** Claude Code's agent system doesn't support per-agent model overrides in configuration files. To set per-agent models in Claude Code, modify the agent file's frontmatter directly.

---

#### Complete Configuration Examples

**Example 1: Minimal Setup (Inherit Current Model)**

```json
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5"
}
```

All agents with `model: inherit` will use `claude-sonnet-4-5`.

---

**Example 2: Cost-Optimized Setup**

```json
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "agents": {
    "test-runner": { "model": "anthropic/claude-haiku-4-5" },
    "codebase-investigator": { "model": "anthropic/claude-haiku-4-5" },
    "internet-researcher": { "model": "anthropic/claude-haiku-4-5" },
    "code-reviewer": { "model": "anthropic/claude-sonnet-4-5" },
    "autonomous-reviewer": { "model": "anthropic/claude-opus-4-5" }
  }
}
```

| Agent | Model | Estimated Cost |
|-------|-------|----------------|
| test-runner | Haiku | $ |
| codebase-investigator | Haiku | $ |
| code-reviewer | Sonnet | $$ |
| autonomous-reviewer | Opus | $$$ |

---

**Example 3: Multi-Provider with API Proxy**

```json
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "myproxy/claude-sonnet-4-5",
  "provider": {
    "myproxy": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My API Proxy",
      "options": {
        "baseURL": "https://api.myproxy.com/v1",
        "apiKey": "{env:MYPROXY_API_KEY}",
        "timeout": 300000
      },
      "models": {
        "claude-haiku-4-5": {
          "name": "Claude Haiku 4.5",
          "limit": { "context": 200000, "output": 8192 }
        },
        "claude-sonnet-4-5": {
          "name": "Claude Sonnet 4.5",
          "limit": { "context": 200000, "output": 64000 }
        },
        "claude-opus-4-5": {
          "name": "Claude Opus 4.5",
          "limit": { "context": 200000, "output": 32000 }
        }
      }
    }
  },
  "agents": {
    "test-runner": { "model": "myproxy/claude-haiku-4-5" }
  },
  "disabled_providers": ["anthropic", "openai", "google"]
}
```

---

**Example 4: Local + Cloud Mix (OpenCode)**

```json
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Local Ollama",
      "options": {
        "baseURL": "http://localhost:11434/v1"
      },
      "models": {
        "qwen2.5-coder:32b": { "name": "Qwen 2.5 Coder 32B" }
      }
    }
  },
  "agents": {
    "codebase-investigator": { "model": "ollama/qwen2.5-coder:32b" }
  }
}
```

---

#### Switching Models at Runtime (OpenCode)

In OpenCode's TUI, you can switch models dynamically:

```
/model
```

This shows all available `providerID/modelID` combinations. Select a different model to change the active model for the current session.

For quick switching between modes:
- Press `Tab` to toggle between Build and Plan agents (if configured)
- Use `/agent <name>` to switch to a specific agent with its configured model

---

#### Troubleshooting Model Configuration

**Issue: Model not found**

```
Error: Model 'myproxy/gpt-4o' not found
```

**Solutions:**
1. Check that the provider is defined in `opencode.json`
2. Verify the model ID exists in the provider's `models` section
3. Ensure you're using the correct format: `providerID/modelID`

**Issue: Agent using wrong model**

**Solutions:**
1. Check configuration precedence (agent config > top-level model > frontmatter)
2. Verify the agent file's frontmatter doesn't have a hardcoded model
3. Restart OpenCode/Claude Code after configuration changes

**Issue: API key not recognized**

**Solutions:**
1. Use `{env:VARIABLE_NAME}` format in config, not hardcoded keys
2. Verify the environment variable is set: `echo $VARIABLE_NAME`
3. For OpenCode, use `/connect` command to authenticate

---

**Quick setup - copy example configs:**

```bash
# For Anthropic (official)
cp docs/opencode.example.anthropic.json opencode.json

# For GLM models
cp docs/opencode.example.glm.json opencode.json

# For multiple providers
cp docs/opencode.example.multi-provider.json opencode.json

# For Claude Code with third-party provider
cat docs/claude-code.example.glm.json >> ~/.claude/settings.json
```

See [docs/README.md](docs/README.md) for more detailed examples.

### Hooks System

Intelligent hooks that provide context-aware assistance:

**Automatic Skill Activation** - The UserPromptSubmit hook analyzes your prompts and suggests relevant skills before Claude responds. Simply type what you want to do, and you'll get skill recommendations if applicable.

**Context Tracking** - The PostToolUse hook tracks file edits during your session, maintaining context for intelligent reminders.

**Gentle Reminders** - The Stop hook provides helpful reminders after Claude responds:
- 💭 TDD reminder when editing source without tests
- ✅ Verification reminder when claiming completion
- 💾 Commit reminder after multiple file edits

See [HOOKS.md](HOOKS.md) for configuration, troubleshooting, and customization details.

## How Ralph Works

**Ralph** (`execute-ralph`) is the autonomous execution mode that completes entire epics without user intervention. It's like having a senior developer who:

1. Executes tasks using TDD
2. Reviews their own work with 5 specialized agents
3. Fixes issues autonomously
4. Commits after each task
5. Only bothers you if something critical fails

### Ralph's Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0: Setup                                                  │
│  ├── Smart triage (bv -robot-triage)                            │
│  ├── Create feature branch from epic name                       │
│  └── Load epic requirements and tasks                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Execute Task                                           │
│  ├── Claim next ready task (bv -robot-next)                     │
│  ├── Implement using TDD skill                                  │
│  └── Run tests via test-runner agent                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Multi-Agent Parallel Review                            │
│  ├── review-quality       → Bugs, security, race conditions     │
│  ├── review-implementation → Requirements match                 │
│  ├── review-testing       → Coverage, test quality              │
│  ├── review-simplification → Over-engineering detection         │
│  └── review-documentation → Doc update needs                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Autonomous Fix (max 2 iterations)                      │
│  ├── If issues found: fix autonomously                          │
│  ├── Re-run affected reviewers only                             │
│  └── Still issues after 2 tries? Flag for user review           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  More tasks?    │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
        ┌─────────┐                  ┌─────────────┐
        │   Yes   │                  │     No      │
        └────┬────┘                  └──────┬──────┘
             │                              │
             └──────────────┐               │
                            ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: Final Critical Review                                  │
│  ├── review-quality (critical issues only)                      │
│  ├── review-implementation (critical gaps only)                 │
│  └── If issues: create remediation tasks and fix                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: Complete                                               │
│  ├── Close epic                                                 │
│  ├── Final commit                                               │
│  └── Present comprehensive summary                              │
└─────────────────────────────────────────────────────────────────┘
```

### Ralph vs Execute-Plan

| Aspect | `/hyperpowers:execute-plan` | `/hyperpowers:execute-ralph` |
|--------|----------------------------|------------------------------|
| **User Interaction** | Stops after each task for review | Only stops on critical failure |
| **Review Points** | Final review only | Per-task (5 agents) + final (2 agents) |
| **Auto-Commit** | Manual | After every task |
| **Git Branch** | Manual | Auto-created from epic name |
| **Best For** | Uncertain requirements, high-risk changes | Well-defined epics, trusted execution |

### When to Use Ralph

**Use Ralph when:**
- ✅ Epic has clear success criteria and anti-patterns
- ✅ Tasks are straightforward implementation
- ✅ You trust autonomous execution
- ✅ You want hands-off operation

**Don't use Ralph when:**
- ❌ Requirements are ambiguous
- ❌ High-risk changes needing human oversight
- ❌ Experimental/exploratory work
- ❌ You want to review between tasks

### Ralph's Safety Limits

- **Max 2 fix iterations** per task (then flags for user)
- **Max 3 remediation rounds** total (then completes with flags)
- **Max 10 tasks** per execution (prevents runaway)
- **Auto-branch creation** (never works on main)
- **Epic requirements are immutable** (won't water down to make execution easier)

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

Choose your platform below:

### OpenCode

Quick start - run from the hyperpowers repo:

```bash
# Clone or navigate to hyperpowers
cd /path/to/hyperpowers

# Run OpenCode (it auto-discovers opencode.json and .opencode/)
opencode
```

That's it! Hyperpowers commands, agents, and skills are now available.

**What you get:**
- Commands: `/brainstorm`, `/write-plan`, `/execute-plan`, `/hyperpowers-version`, etc.
- Agents: `@code-reviewer`, `@test-runner`, `@codebase-investigator`, `@internet-researcher`
- Skills: All workflows auto-loaded via local discovery
- Safety: `.env` and sensitive files are protected

**Verify it works:**
```
/hyperpowers-version
# Should show plugin version and installation status
```

---

**For your own projects**, copy these files:

```bash
# Copy to your project
cp hyperpowers/opencode.json your-project/
cp -r hyperpowers/.opencode your-project/

# Install dependencies
cd your-project/.opencode
bun install
cd ..

# Run OpenCode
opencode
```

---

**Install via npm** (alternative):

```json
// In your project's opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@dpolishuk/hyperpowers-opencode"]
}
```

### Claude Code

**Recommended: Install from GitHub**

```text
/plugin marketplace add dpolishuk/myhyperpowers
/plugin install myhyperpowers@myhyperpowers --scope user
```

**Note for legacy installs:**

If you previously installed this plugin under the legacy name `withzombies-hyper`, you should uninstall it first:

```text
/plugin uninstall withzombies-hyper@withzombies-hyper
```

Then install with the new name:

```text
/plugin install myhyperpowers@myhyperpowers --scope user
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

### Codex CLI

Use Codex wrappers from this repo in two steps:

```bash
# 1) Generate/update wrappers from canonical sources
node scripts/sync-codex-skills.js --write

# 2) Install globally (~/.codex/skills)
bash scripts/install-codex-plugin.sh --global
```

For local project install:

```bash
bash scripts/install-codex-plugin.sh --local --target /path/to/project
```

Explicit invocation in Codex uses skill names (not custom slash-command registration):

```text
$codex-command-write-plan Draft a plan for feature X.
$codex-command-execute-plan Execute task bd-123.
$codex-skill-executing-plans Continue from current bd ready task.
```

You can also use `/skills` in Codex UI to discover and select the same wrappers.

### After Installation: Configure Models

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

**Or customize manually:**

```json
// opencode.json (OpenCode)
{
  "model": "provider/glm-4.7",
  "agents": {
    "test-runner": { "model": "provider/glm-4.5" }
  }
}
```

See [docs/README.md](docs/README.md) for more example configurations.

### Troubleshooting

**OpenCode:**

| Issue | Solution |
|-------|----------|
| Commands not found | Ensure you're running `opencode` from a directory with `opencode.json` |
| Agents not working | Check that `.opencode/agents/*.md` files exist and have valid YAML frontmatter |
| Skills not loading | Run `bun install` in `.opencode/` directory to install dependencies |
| `.env` not protected | Verify `.opencode/plugins/hyperpowers-safety.ts` exists and is loaded |

**Claude Code:**

| Issue | Solution |
|-------|----------|
| Commands not showing | Run `/plugin list` to verify installation |
| Plugin not loading | Check `~/.claude/plugins/` for `myhyperpowers@myhyperpowers` directory |
| Hooks not firing | Restart Claude Code after installation |
| Models not inheriting | Ensure agent files have `model: inherit` in frontmatter |

**Getting help:**

- OpenCode: Check `.opencode/` directory structure matches repository
- Claude Code: Run `/plugin info myhyperpowers@myhyperpowers` for diagnostics
- Both: Open an issue at https://github.com/dpolishuk/myhyperpowers/issues

**Updating:**

```text
# Claude Code
/plugin update myhyperpowers@myhyperpowers

# OpenCode: git pull in the hyperpowers directory
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
- All success criteria met ✓
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

Generated output is written to `.agents/skills/**` (in this repo it maps to `.kimi/skills` via symlink).

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

### Codex Installer

Use the installer to copy generated Codex wrappers into local or global `.codex/skills` paths:

```bash
# Global install (~/.codex/skills)
bash scripts/install-codex-plugin.sh --global

# Local install (<target>/.codex/skills)
bash scripts/install-codex-plugin.sh --local --target /path/to/project

# Status and version
bash scripts/install-codex-plugin.sh --status
bash scripts/install-codex-plugin.sh --version

# Custom Codex home override
bash scripts/install-codex-plugin.sh --codex-home /custom/.codex
```

Installer behavior:
- Keeps a timestamped backup when replacing existing `codex-*` wrappers.
- Retains only the 3 newest backups.
- Is idempotent for already-installed same-version wrappers unless `--force` is used.
- If “commands are not available”, invoke wrappers explicitly via `$codex-*` or select them in `/skills`.

For a focused Codex setup guide, see `.codex/INSTALL.md`.

## License

MIT

## Author

Ryan Stortz (ryan@withzombies.com) and Dmitry Polishuk

## Acknowledgments

Inspired by [obra/superpowers](https://github.com/obra/superpowers) - a strong foundation for structured development workflows
