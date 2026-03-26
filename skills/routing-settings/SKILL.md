---
name: routing-settings
description: Interactive wizard to configure which AI model runs for each Hyperpowers agent in Claude Code
---

# Routing Settings Wizard (Claude Code)

Configure which model each Hyperpowers agent uses. Changes are written to agent frontmatter files.

## Step 1: Read current agent model configs

Read the YAML frontmatter `model:` field from each agent file. The agent files are in the `agents/` directory of the hyperpowers plugin (typically `~/.claude/agents/`).

Read these files NOW and build a table:

| Agent | Current Model | Group |
|-------|--------------|-------|
| autonomous-reviewer | (from frontmatter) | reviewers |
| code-reviewer | (from frontmatter) | reviewers |
| codebase-investigator | (from frontmatter) | workers |
| internet-researcher | (from frontmatter) | workers |
| review-documentation | (from frontmatter) | reviewers |
| review-implementation | (from frontmatter) | reviewers |
| review-quality | (from frontmatter) | reviewers |
| review-simplification | (from frontmatter) | reviewers |
| review-testing | (from frontmatter) | reviewers |
| test-effectiveness-analyst | (from frontmatter) | reviewers |
| test-runner | (from frontmatter) | workers |

Note: `ralph` is not listed because it is not a subagent — it IS Claude Code itself.

**Agent groups:**
- **workers**: test-runner, codebase-investigator, internet-researcher (high-volume, use fast models)
- **reviewers**: all review-*, code-reviewer, autonomous-reviewer, test-effectiveness-analyst (need reasoning, use capable models)

**Model options for Claude Code:**
- `inherit` — use the parent session's model (default)
- `sonnet` — Claude Sonnet (balanced)
- `opus` — Claude Opus (most capable)
- `haiku` — Claude Haiku (fastest, cheapest)
- Full model IDs also work: `claude-sonnet-4-5`, `claude-opus-4-5`, `claude-haiku-4-5`

Show the table and available model options to the user.

## Step 2: Ask what to change

Use AskUserQuestion to ask one question at a time:

**First question — what action?**

Options:
1. **Set a single agent** — pick agent + model
2. **Set a group** — pick group (workers/reviewers/all) + model
3. **Apply a preset** — cost-optimized or quality-first
4. **Done** — exit without changes

### Set single agent flow
1. Ask: which agent? (show the 11 agent names)
2. Ask: which model? (inherit, sonnet, opus, haiku)
3. Edit the agent's `.md` file — change the `model:` field in YAML frontmatter

### Set group flow
1. Ask: which group? (workers, reviewers, all)
2. Ask: which model? (inherit, sonnet, opus, haiku)
3. Edit all agents in the group — change `model:` field in each

### Apply preset flow
1. Ask: which preset?
   - **cost-optimized**: workers use `haiku`, reviewers use `sonnet`, autonomous-reviewer uses `opus`
   - **quality-first**: all agents use `sonnet`, autonomous-reviewer uses `opus`
2. Edit all agent files with the preset values

## Step 3: Show result

After making changes, re-read the agent files and show the updated table to confirm.

## Rules

- Use the Read tool to read agent `.md` files
- Use the Edit tool to change the `model:` field in YAML frontmatter
- Never delete or modify anything other than the `model:` field
- Use AskUserQuestion for all interactive questions
- Show the table before and after changes
