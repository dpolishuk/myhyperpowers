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

**Local development** (if you're contributing):

```text
claude --plugin-dir .
```

**From local clone:**

```text
/plugin marketplace add /absolute/path/to/hyperpowers
/plugin install myhyperpowers@myhyperpowers --scope user
```

**Verify installation:**

```text
/help
# Should show /hyperpowers:* commands
```

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
