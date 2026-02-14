# Hyperpowers Gemini CLI Extension

A Gemini CLI extension that brings structured development workflows to Gemini CLI users.

## Features

- **Skills**: Access 24+ hyperpowers skills (brainstorming, TDD, planning, etc.)
- **Agents**: Invoke specialized agents (test-runner, code-reviewer, etc.)
- **Issue Tracking**: Full bd (beads) integration
- **Slash Commands**: Quick access to common workflows (/brainstorm, /write-plan, etc.)

## Installation

### Prerequisites

- [Gemini CLI](https://geminicli.com/) installed
- bd (beads) CLI installed (for issue tracking)
- Node.js (for MCP servers)

### Install from GitHub

```bash
gemini extensions install https://github.com/dmpol/hyperpowers --ref main
```

Or install from a specific subdirectory if needed.

### Local Development

```bash
# Clone the repository
git clone https://github.com/dmpol/hyperpowers.git
cd hyperpowers

# Link for local development
gemini extensions link .gemini-extension
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
