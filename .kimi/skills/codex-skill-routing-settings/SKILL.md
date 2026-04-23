---
name: codex-skill-routing-settings
description: "Use when the original skill 'routing-settings' applies. Interactive wizard to configure which AI model runs for each Hyperpowers agent in Claude Code"
---

<!-- Generated from skills/routing-settings/SKILL.md -->

<codex_compat>
Note: The AskUserQuestion tool is not available on this platform.
Instead, format your questions using the structured text blocks: "Question:", "Options:", "Priority:".
Verification of Phase 1 requires at least 3 such properly formatted question blocks in your message history.
</codex_compat>

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
| devops | (from frontmatter) | guards |
| internet-researcher | (from frontmatter) | workers |
| knowledge-aggregator | (from frontmatter) | researchers |
| planner | (from frontmatter) | planners |
| review-documentation | (from frontmatter) | reviewers |
| review-implementation | (from frontmatter) | reviewers |
| review-quality | (from frontmatter) | reviewers |
| review-simplification | (from frontmatter) | reviewers |
| review-testing | (from frontmatter) | reviewers |
| security-scanner | (from frontmatter) | guards |
| test-effectiveness-analyst | (from frontmatter) | reviewers |
| test-runner | (from frontmatter) | workers |

Note: `ralph` is not listed because it uses `inherit` and orchestrates other agents.

**Agent groups:**
- **workers**: test-runner, codebase-investigator, internet-researcher (high-volume, use fast models like haiku)
- **researchers**: knowledge-aggregator (synthesis across sources, use capable models like sonnet)
- **planners**: planner (deep architectural reasoning, use most capable model like opus)
- **guards**: security-scanner, devops (analysis and pattern matching, use sonnet)
- **reviewers**: all review-*, code-reviewer, autonomous-reviewer, test-effectiveness-analyst (need reasoning, use sonnet; autonomous-reviewer recommended opus)

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
2. **Set a group** — pick group (workers/researchers/planners/guards/reviewers/all) + model
3. **Apply a preset** — cost-optimized or quality-first
4. **Done** — exit without changes

### Set single agent flow
1. Ask: which agent? (show the 15 agent names from Step 1 table)
2. Ask: which model? (inherit, sonnet, opus, haiku)
3. Edit the agent's `.md` file — change the `model:` field in YAML frontmatter

### Set group flow
1. Ask: which group? (workers, researchers, planners, guards, reviewers, all)
2. Ask: which model? (inherit, sonnet, opus, haiku)
3. Edit all agents in the group — change `model:` field in each

### Apply preset flow
1. Ask: which preset?
   - **cost-optimized**: workers use `haiku`, researchers/guards/reviewers use `sonnet`, planners + autonomous-reviewer use `opus`
   - **quality-first**: all agents use `sonnet`, planners + autonomous-reviewer use `opus`
2. Edit all agent files with the preset values

## Step 3: Show result

After making changes, re-read the agent files and show the updated table to confirm.

## Rules

- Use the Read tool to read agent `.md` files
- Use the Edit tool to change the `model:` field in YAML frontmatter
- Never delete or modify anything other than the `model:` field
- Use AskUserQuestion for all interactive questions
- Show the table before and after changes
