---
description: Show the supported OpenCode tm and Linear setup path for this branch
---

Use the shell tool to print the following guidance exactly:

```text
OpenCode tm + Linear setup for this branch:

1. From a XPowers checkout, run `./scripts/install.sh --opencode`
   - Installs OpenCode assets
   - Provisions the shared tm CLI used by this branch

2. Configure Linear credentials:
   - `export LINEAR_API_KEY=...`
   - `export LINEAR_TEAM_KEY=...`

3. Verify the shared tm path:
   - `~/.local/bin/tm --help`
   - `tm sync`

4. OpenCode project config belongs in `opencode.json`
   - Use the `mcp` key for MCP servers
   - Use `.opencode/` for project-local commands, plugins, agents, and skills

See `.opencode/INSTALL.md` and `docs/linear-mcp-setup.md` for the full setup guide.
```
