# XPowers Gemini CLI Extension

A Gemini CLI extension that brings structured development workflows to Gemini CLI users.

> 📚 **Looking for the main xpowers documentation?** See the [Global README](../README.md)

## Features

- **Skills**: Access 24+ xpowers skills (brainstorming, TDD, planning, etc.)
- **Agents**: Invoke specialized agents (test-runner, code-reviewer, etc.)
- **Task Management**: Gemini-facing `tm` tools plus optional Linear sync
- **Slash Commands**: Quick access to namespaced workflows (`/xpowers:brainstorm`, `/xpowers:write-plan`, `/xpowers:refactor-design`, etc.)

## Installation

### Prerequisites

Before installing the xpowers extension, ensure you have:

1. **Gemini CLI** installed
   ```bash
   # Install via npm
   npm install -g @google/gemini-cli
   
   # Or download from https://geminicli.com/
   ```

2. **Node.js** (v18 or higher) for MCP servers
   ```bash
   node --version  # Should show v18.x.x or higher
   ```

3. **bd (beads) CLI** (recommended because `tm` delegates to bd locally)
   ```bash
   # Install bd CLI
   npm install -g @dmpol/beads
   
   # Or use npx
   npx @dmpol/beads
   ```

### Install to Gemini CLI

#### Option 1: Unified installer (Recommended on this branch)

This is the preferred path for Gemini users on this branch because it installs the Gemini extension **and** provisions the shared `tm` runtime used by `tm sync`.

```bash
git clone https://github.com/dpolishuk/xpowers.git
cd xpowers

# Install Gemini support + shared tm runtime
./scripts/install.sh --gemini

# For development, link instead of copy
./scripts/install.sh --gemini --symlink
```

#### Option 2: Manual extension install (fallback)

```bash
git clone https://github.com/dpolishuk/xpowers.git
cd xpowers

# Install the extension manually
gemini extensions install .gemini-extension
```

Manual extension install alone does **not** provision the shared `tm` runtime for this branch. If you use this fallback path, you still need the branch runtime installed before expecting `tm sync` + Linear support to work.

### Verify Installation

After installation, verify the extension is working:

```bash
# List installed extensions
gemini extensions list

# You should see:
# xpowers 1.0.0

# Check available tools
gemini tools

# You should see xpowers tools like:
# - skills_brainstorming
# - skills_test_driven_development
# - agent_test_runner
# - tm_ready
# - tm_sync
```

To enable Linear sync for this branch, configure the required credentials and verify the shared tm runtime:

```bash
export LINEAR_API_KEY="lin_api_your_key_here"
export LINEAR_TEAM_KEY="ENG"

~/.local/bin/tm --help
tm sync
```

### Update the Extension

```bash
# Update to latest version
gemini extensions update xpowers

# Or update all extensions
gemini extensions update --all
```

### Uninstall

```bash
gemini extensions uninstall xpowers
```

### Local Development

For contributing or customizing:

```bash
# Clone the repository
git clone https://github.com/dpolishuk/xpowers.git
cd xpowers

# Link for local development (changes reflect immediately)
gemini extensions link .gemini-extension

# To unlink:
gemini extensions unlink xpowers
```

## Usage

### Slash Commands

Once installed, use these commands in Gemini CLI:

- `/xpowers:brainstorm` - Start a brainstorming session
- `/xpowers:write-plan` - Create implementation plans
- `/xpowers:execute-plan` - Execute plans iteratively
- `/xpowers:review-implementation` - Review code
- `/xpowers:refactor-design` - Design safe refactors and test strategy
- `/xpowers:refactor-diagnose` - Identify refactor targets and technical debt
- `/xpowers:refactor-execute` - Execute refactors with controlled rollout
- `/xpowers:tm-linear-setup` - Show the supported Gemini tm/Linear setup path for this branch

### Skills and Tools

Skills are available through Gemini’s extension skill system, while MCP servers expose Gemini-callable tools. When you invoke xpowers, you can:

1. Use skills for structured guidance
2. Invoke agents for specific tasks
3. Track work through the Gemini-facing `tm` surface

### Task Management

The extension exposes a tm-oriented task-management surface for this branch:

```bash
tm ready                      # Find available work
tm show <id>                  # View issue details
tm list --parent <epic-id>    # List child tasks
tm update <id> --status in_progress  # Claim work
tm close <id>                 # Complete work
tm sync                       # Push local work to Linear (when configured)
```

Legacy `bd_*` Gemini tools are not registered by default. Use the `tm_*` tools for normal task-management workflows.

## Extension Structure

```
.gemini-extension/
├── gemini-extension.json # Extension manifest
├── GEMINI.md            # Context instructions for Gemini
├── mcp/
│   ├── skills-server.js # MCP server for skills
│   ├── agents-server.js # MCP server for agents
│   ├── bd-server.js     # Legacy unregistered MCP server for bd compatibility testing
│   └── tm-server.js     # MCP server for tm task management + sync
├── agents/              # Sub-agent definitions
├── commands/            # Slash command definitions
├── hooks/               # Lifecycle hooks
├── skills/              # Symlink to ../skills/
└── README.md            # This file
```

## Development

### MCP Servers

The extension uses Model Context Protocol (MCP) to expose capabilities:

1. **skills-server**: Scans skills/ directory and exposes tools
2. **agents-server**: Provides agent invocation
3. **tm-server**: Exposes shared tm task-management + sync commands

`bd-server.js` remains in the tree only for legacy compatibility tests and is not registered in the default manifest.

### Adding New Skills

Skills are defined in `../skills/*/SKILL.md`. The extension automatically discovers them via the symlink.

### Testing

Run tests for MCP servers:

```bash
node --test .gemini-extension/tests/*.test.js
```

## Configuration

Server paths are controlled through runtime environment (extension defaults are deterministic):

- `TM_PATH`: Path to tm executable (default: `~/.local/bin/tm` when present, otherwise `tm`)
- `BD_PATH`: Path to bd executable (default: `bd`, used for legacy bd server)
- `SKILLS_PATH`: Path to skills directory (default: extension `skills/` target)
- `AGENTS_PATH`: Path to agents directory (default: extension `agents/`, fallback: extension parent `agents/`)

## License

MIT

## Contributing

See the main xpowers repository for contribution guidelines.
