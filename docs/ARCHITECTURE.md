# Hyperpowers Architecture

Hyperpowers is a multi-host framework that provides structured workflows, best practices, and specialized agents for AI-assisted software development. It supports five developer hosts simultaneously by sharing a common core of skills, agents, commands, and hooks through platform-specific adapters.

## Host Platforms

Each host has its own directory containing platform-specific metadata, configuration, and (where needed) compiled plugins or extensions:

| Directory | Host | Technology |
|-----------|------|------------|
| `.claude-plugin/` | Claude Code | JSON plugin manifest |
| `.opencode/` | OpenCode | TypeScript plugins + Bun |
| `.gemini-extension/` | Gemini CLI | Python MCP servers + JSON manifest |
| `.kimi/` | Kimi CLI | YAML + Markdown agents/skills |
| `.pi/` | Pi | Markdown agents + extensions |

### Platform Details

#### Claude Code (`.claude-plugin/`)
- Loads skills from `skills/` and agents from `agents/` directly.
- Plugin manifest in `plugin.json` declares version and entrypoints.
- Hooks are registered via `hooks/hooks.json`.
- Commands are surfaced as slash commands.

#### OpenCode (`.opencode/`)
- TypeScript plugins in `.opencode/plugins/` provide custom tooling.
- Skills are symlinked from `.opencode/skills/` to `../skills/` so the canonical source remains shared.
- Agents and commands have OpenCode-specific wrappers in `.opencode/agents/` and `.opencode/commands/`.
- Built with Bun; run `bun install && bun run build` inside `.opencode/` to compile.

#### Gemini CLI (`.gemini-extension/`)
- Python-based MCP servers in `.gemini-extension/mcp/` expose tools to the Gemini CLI.
- Extension manifest in `gemini-extension.json` registers commands and agents.
- Skills are symlinked from `.gemini-extension/skills/` to `../skills/`.
- Tests in `.gemini-extension/tests/` validate the extension and MCP behavior.

#### Kimi CLI (`.kimi/`)
- Uses YAML (`hyperpowers.yaml`) and Markdown for configuration.
- Agents and skills are copied or referenced from the canonical locations.
- Install guide in `.kimi/INSTALL.md` describes setup steps.

#### Pi (`.pi/`)
- Extension metadata in `.pi/extensions/hyperpowers/`.
- Agent instructions in `.pi/AGENTS.md`.
- Installable via Pi's extension system.

## Shared Resources

All hosts draw from the same canonical content in the repository root:

### `skills/`
Reusable workflow definitions. Each skill is a directory containing `SKILL.md` with YAML frontmatter (`name`, `description`) and structured body sections (overview, rigidity level, process, examples, critical rules, verification checklist).

Hosts consume skills in platform-native ways:
- Claude Code reads `SKILL.md` files directly.
- OpenCode and Gemini symlink to `skills/`.
- Codex CLI uses generated wrappers in `.kimi/skills/codex-skill-*` (produced by `scripts/sync-codex-skills.js`).

### `agents/`
Specialized subagent prompts for domain-specific tasks (e.g., `planner.md`, `security-scanner.md`, `code-reviewer.md`). Each agent file contains YAML frontmatter with `name`, `description`, and `model`, followed by detailed instructions.

### `commands/`
Slash command definitions. These are short Markdown files that map a command name to a skill or workflow (e.g., `brainstorm.md`, `execute-plan.md`).

### `hooks/`
Automatic behaviors triggered by IDE events:
- `session-start/` — Runs at session start (e.g., loads `using-hyper` skill).
- `user-prompt-submit/` — Analyzes prompts and suggests skills.
- `pre-tool-use/` — Blocks dangerous operations (e.g., direct reads of `.beads/issues.jsonl`, pre-commit edits).
- `post-tool-use/` — Tracks edits, blocks truncation markers, guards pre-commit hooks.
- `stop/` — Gentle reminders at session end.
- `test/` — Hook integration tests.

Hook implementations use Bash, Python, and JavaScript depending on the event type and complexity.

## Data Flow

```text
+----------------+     +----------------+     +----------------+
|  skills/       |     |  agents/       |     |  commands/     |
|  agents/       |     |  commands/     |     |  hooks/        |
|  hooks/        |     |                |     |                |
+----------------+     +----------------+     +----------------+
         |                       |                       |
         +-----------------------+-----------------------+
                                 |
          +----------------------+----------------------+
          |                      |                      |
   .claude-plugin/       .opencode/            .gemini-extension/
          |                      |                      |
   .kimi/                 .pi/
```

The canonical source lives in the repository root. Host-specific directories contain only platform-specific metadata, compiled artifacts, and symlinks. When a skill or agent is updated in the canonical location, all hosts that consume it see the change immediately (or after wrapper regeneration for Codex).

## Codex Wrapper Sync

Codex CLI cannot read the native `SKILL.md` format directly, so `scripts/sync-codex-skills.js` generates wrapper directories under `.kimi/skills/codex-*`. Each wrapper contains a thin `SKILL.md` that points back to the canonical skill.

This step is mandatory in CI (`node scripts/sync-codex-skills.js --check`) to ensure wrappers never drift from the canonical source.
