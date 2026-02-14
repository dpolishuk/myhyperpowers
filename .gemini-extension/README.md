# Hyperpowers Gemini CLI Extension

A Gemini CLI extension that brings structured development workflows to Gemini CLI users.

> 📚 **Looking for the main hyperpowers documentation?** See the [Global README](../README.md)

## Features

- **Skills**: Access 24+ hyperpowers skills (brainstorming, TDD, planning, etc.)
- **Agents**: Invoke specialized agents (test-runner, code-reviewer, etc.)
- **Issue Tracking**: Full bd (beads) integration
- **Slash Commands**: Quick access to common workflows (/brainstorm, /write-plan, etc.)

## Installation

### Prerequisites

Before installing the hyperpowers extension, ensure you have:

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

3. **bd (beads) CLI** (optional, for issue tracking)
   ```bash
   # Install bd CLI
   npm install -g @dmpol/beads
   
   # Or use npx
   npx @dmpol/beads
   ```

### Install to Gemini CLI

#### Option 1: Install from GitHub (Recommended)

```bash
# Install the extension
gemini extensions install https://github.com/dmpol/hyperpowers --ref main

# The extension will be installed to:
# ~/.config/gemini/extensions/hyperpowers/
```

#### Option 2: Install from Local Directory

If you've cloned the repository:

```bash
# Navigate to the repository
cd /path/to/hyperpowers

# Link the extension for local development
gemini extensions link .gemini-extension

# Or install it
gemini extensions install .gemini-extension
```

#### Option 3: Install with Auto-Update

```bash
# Install with auto-update enabled
gemini extensions install https://github.com/dmpol/hyperpowers --auto-update
```

### Verify Installation

After installation, verify the extension is working:

```bash
# List installed extensions
gemini extensions list

# You should see:
# hyperpowers 1.0.0

# Check available tools
gemini tools

# You should see hyperpowers tools like:
# - skills_brainstorming
# - skills_test_driven_development
# - agent_test_runner
# - bd_ready
```

### Update the Extension

```bash
# Update to latest version
gemini extensions update hyperpowers

# Or update all extensions
gemini extensions update --all
```

### Uninstall

```bash
gemini extensions uninstall hyperpowers
```

### Local Development

For contributing or customizing:

```bash
# Clone the repository
git clone https://github.com/dmpol/hyperpowers.git
cd hyperpowers

# Link for local development (changes reflect immediately)
gemini extensions link .gemini-extension

# To unlink:
gemini extensions unlink hyperpowers
```

## Usage

### Slash Commands

Once installed, use these commands in Gemini CLI:

- `/brainstorm` - Start a brainstorming session
- `/write-plan` - Create implementation plans
- `/execute-plan` - Execute plans iteratively
- `/review-implementation` - Review code

### Skills as Tools

Skills are available as tools. When you invoke hyperpowers, you can:

1. Use skills for structured guidance
2. Invoke agents for specific tasks
3. Track work with bd integration

### Issue Tracking

The extension integrates with bd (beads):

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
```

## Extension Structure

```
.gemini-extension/
├── gemini.json          # Extension manifest
├── GEMINI.md            # Context instructions for Gemini
├── mcp/
│   ├── skills-server.js # MCP server for skills
│   ├── agents-server.js # MCP server for agents
│   └── bd-server.js     # MCP server for bd integration
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
3. **bd-server**: Wraps bd CLI commands

### Adding New Skills

Skills are defined in `../skills/*/SKILL.md`. The extension automatically discovers them via the symlink.

### Testing

Run tests for MCP servers:

```bash
node --test tests/gemini-extension/*.test.js
```

## Configuration

Configure settings during installation or via Gemini CLI:

- `bd-path`: Path to bd executable (default: "bd")
- `skills-path`: Path to skills directory (default: "./skills")

## License

MIT

## Contributing

See the main hyperpowers repository for contribution guidelines.
