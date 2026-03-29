# Linear Integration Setup

Complete guide to setting up Linear with the tm CLI and MCP server.

## Step 1: Create a Linear Workspace

If you don't have a Linear account yet:

1. Go to [linear.app](https://linear.app) and sign up
2. Create a workspace (e.g., "My Projects")
3. Create a team — this is where your issues will live
   - Go to **Settings** (gear icon, bottom-left) -> **Teams** -> **Create team**
   - Give it a name (e.g., "Engineering") and a **key** (e.g., "ENG")
   - The team key is short identifier used in issue IDs like `ENG-123`

## Step 2: Generate an API Key

1. In Linear, go to **Settings** -> **API** -> **Personal API keys**
2. Click **Create key**, give it a label (e.g., "tm-sync")
3. Copy the key — it starts with `lin_api_`
4. Save it somewhere safe; you won't see it again

## Step 3: Configure tm sync

If you are using OpenCode on this branch, from a Hyperpowers checkout run the unified installer first so the shared tm runtime is present:

```bash
./scripts/install.sh --opencode
~/.local/bin/tm --help
```

tm sync pushes your local bd issues to Linear. Choose one method to store credentials:

### Option A: Environment Variables (per-session)

```bash
export LINEAR_API_KEY="lin_api_your_key_here"
export LINEAR_TEAM_KEY="ENG"   # Your team key from Step 1
```

Add these to your `~/.bashrc` or `~/.zshrc` to persist across sessions.

### Option B: bd Config (per-repo, persistent)

```bash
tm config set linear.api-key "lin_api_your_key_here"
tm config set linear.team-key "ENG"
```

These are stored in `.beads/config.yaml` and persist across sessions.

### Verify it works

```bash
tm sync
```

Expected output (on stderr):
```
tm-sync: Authenticated as Your Name
tm-sync: Synced 5 issues (5 created, 0 updated, 0 unchanged)
```

Your bd issues should now appear in Linear under your team.

## Step 4: Set Up Linear MCP Server (Optional)

The MCP server gives Claude Code / OpenCode **read access** to your Linear workspace — view team issues, project boards, and timelines directly from the AI assistant.

### Claude Code

Add to `~/.claude/settings.local.json`:

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

Add to your project-root `opencode.json`:

```json
{
  "mcp": {
    "linear": {
      "type": "local",
      "command": ["npx", "-y", "@tacticlaunch/mcp-linear@1.0.12"],
      "environment": {
        "LINEAR_API_KEY": "{env:LINEAR_API_KEY}"
      }
    }
  }
}
```

### Gemini CLI

For this branch, the preferred Gemini path is the unified installer from a Hyperpowers checkout:

```bash
./scripts/install.sh --gemini
~/.local/bin/tm --help
```

If you also want direct Linear MCP read access in Gemini CLI, add the MCP server to your Gemini settings (for example `~/.gemini/settings.json`):

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

## How It All Fits Together

```
You (local)                    Linear (cloud)
+-----------+    tm sync       +---------------+
| bd issues | ───────────────> | Linear issues |
| (offline) |                  | (team-visible)|
+-----------+                  +---------------+
     ^                                ^
     |                                |
  tm create                    MCP server reads
   tm update                    (Claude/OpenCode/Gemini)
  tm close
```

| Action | Tool | Description |
|--------|------|-------------|
| Create/update/close tasks | `tm` CLI | Writes to bd locally |
| View your tasks | `tm show`, `tm list` | Reads from bd (fast, offline) |
| Push changes to Linear | `tm sync` | Batch sync after local work |
| View team tasks | Linear MCP | Reads directly from Linear API |
| View project boards | Linear MCP | Access Linear boards, timelines |

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
| status: blocked | Explicit `Blocked` state only; otherwise left unchanged |
| design (markdown) | Description (markdown) |

### Sync Ownership Contract

- `tm sync` is a one-way sync from local bd/tm issues to Linear.
- The integration owns the synced issue title, description, priority, state, and type label for mapped issues.
- Type labels are synced as an owned set, so the Linear issue is updated with the single bd-derived type label (`Epic`, `Feature`, `Task`, or `Bug`).
- `blocked` only maps when the Linear team has an explicit workflow state whose name includes `Blocked`; otherwise the sync leaves the state unchanged instead of silently degrading it to Todo/Backlog.
- Duplicate prevention and relinking rely on `<!-- [bd:ID] -->` markers in the Linear description. Do not remove them.
- If an existing mapping points at a deleted issue, `tm sync` recreates the issue; if the marker has moved to a different issue, `tm sync` re-links to that issue before applying updates.
- Per-issue API failures (including rate limits) are tolerated so the rest of the batch can continue. The final sync summary reports failed issues and exits non-zero when any issue fails.

## Daily Workflow

```bash
# Morning: check what's ready
tm ready

# Work on tasks locally
tm update bd-42 --status in_progress
# ... code ...
tm close bd-42

# End of session: push to Linear so your team sees progress
tm sync
```

## Troubleshooting

**"Linear not configured, skipping"** — Set `LINEAR_API_KEY` and `LINEAR_TEAM_KEY` via env vars or `tm config set`.

**"LINEAR_API_KEY is set but LINEAR_TEAM_KEY is missing"** — You need both. Set the team key: `export LINEAR_TEAM_KEY="ENG"` or `tm config set linear.team-key "ENG"`.

**"Linear API key invalid or expired"** — Generate a new key at Linear Settings -> API -> Personal API keys.

**"Team not found"** — Verify your `LINEAR_TEAM_KEY` matches your team's key in Linear (Settings -> Teams -> click your team -> the short key like "ENG").

**"bd list failed"** — Make sure `bd` is installed and you're in a repo with `.beads/` initialized. Run `bd init` if needed.

**MCP server not responding** — Run `npx -y @tacticlaunch/mcp-linear@1.0.12` directly to check for errors. Ensure the API key is valid and Node.js is installed.

**Duplicate issues after fresh clone** — tm sync uses `[bd:ID]` markers in Linear descriptions to re-link issues. Don't remove these markers from Linear descriptions. If duplicates appear, delete the extras in Linear and run `tm sync` again to re-link.
