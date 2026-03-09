# Linear MCP Server Setup

Optional: Configure a Linear MCP server for direct read access to your Linear workspace. This complements `tm sync` — tm handles the write path (bd -> Linear), while the MCP server provides ad-hoc read access to team context.

## Prerequisites

- A [Linear](https://linear.app) account
- A Linear API key (Settings -> API -> Personal API keys)

## Configuration

### Claude Code

Add to your user settings (`~/.claude/settings.local.json`):

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "@tacticlaunch/mcp-linear@1.0.12"],
      "env": {
        "LINEAR_API_KEY": "lin_api_your_key_here"
      }
    }
  }
}
```

### OpenCode

Add to `.opencode/config.json`:

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "@tacticlaunch/mcp-linear@1.0.12"],
      "env": {
        "LINEAR_API_KEY": "lin_api_your_key_here"
      }
    }
  }
}
```

> **Security note:** The MCP server version is pinned above. Periodically check for updates with `npm view @tacticlaunch/mcp-linear version` and bump after reviewing the changelog.

## tm sync Configuration

To enable `tm sync` to push issues to Linear:

```bash
# Set your API key (choose one method):
export LINEAR_API_KEY="lin_api_your_key_here"
# Or persist in tm config:
tm config set linear.api-key "lin_api_your_key_here"

# Set your team key (e.g., "ENG", "PROD"):
export LINEAR_TEAM_KEY="ENG"
# Or persist:
tm config set linear.team-key "ENG"
```

Then run:

```bash
tm sync    # Syncs git (bd sync) + pushes issues to Linear
```

## How They Work Together

| Action | Tool | Description |
|--------|------|-------------|
| Create/update/close tasks | `tm` CLI | Writes to bd locally, syncs to Linear on `tm sync` |
| View your tasks | `tm show`, `tm list` | Reads from bd (fast, offline) |
| View team tasks | Linear MCP | Reads directly from Linear API |
| View project boards | Linear MCP | Access Linear boards, timelines |
| Push changes to Linear | `tm sync` | Batch sync after local work |

## Field Mapping

| bd Field | Linear Field |
|----------|-------------|
| type (epic/feature/task/bug) | Label |
| priority P0 (critical) | Priority 1 (Urgent) |
| priority P1 (high) | Priority 2 (High) |
| priority P2 (medium) | Priority 3 (Medium) |
| priority P3 (low) | Priority 4 (Low) |
| priority P4 (backlog) | Priority 0 (No priority) |
| status: open | State: Todo |
| status: in_progress | State: In Progress |
| status: closed | State: Done |
| design (markdown) | Description (markdown) |

## Troubleshooting

**"Linear not configured, skipping"** — Set `LINEAR_API_KEY` and `LINEAR_TEAM_KEY` env vars or persist them with `tm config set`.

**"Linear API key invalid or expired"** — Generate a new key at Linear Settings -> API -> Personal API keys.

**"Team not found"** — Verify your `LINEAR_TEAM_KEY` matches your team's key in Linear (Settings -> Teams).

**MCP server not responding** — Run `npx @tacticlaunch/mcp-linear` directly to check for errors. Ensure the API key is valid.
