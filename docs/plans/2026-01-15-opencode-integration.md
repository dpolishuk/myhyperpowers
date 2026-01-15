# OpenCode Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add first-class OpenCode support with generated skills, commands, agents, plugin hooks, docs, and validation/CI.

**Architecture:** Keep `skills/*/SKILL.md` as the source of truth and generate `.opencode/skill/*/SKILL.md` via a deterministic Node.js sync script. Add OpenCode-specific commands, agents, plugin, and config under `.opencode/`, plus docs and CI validation at repo root.

**Tech Stack:** Node.js, TypeScript (plugin), Markdown, GitHub Actions.

### Task 1: Add OpenCode project rules and config

**Files:**
- Create: `AGENTS.md`
- Create: `opencode.json`

**Step 1: Draft `AGENTS.md`**

```markdown
# AGENTS

Hyperpowers provides structured workflows, skills, commands, agents, and hooks for OpenCode.

## OpenCode Usage
- Skills: use `skill` to load `brainstorming`, `writing-plans`, etc.
- Commands: run `/hp-brainstorm`, `/hp-write-plan`, `/hp-execute-plan`, `/hp-review`, `/hp-finish`
- Agents: `@code-reviewer`, `@codebase-investigator`, `@internet-researcher`, `@test-runner`

## Recommended Workflow
brainstorm -> plan -> execute -> verify -> review -> finish

## Conventions
- Run verification before claiming completion
- Use TDD where tests exist
- Keep changes small and reviewable
```

**Step 2: Draft `opencode.json`**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["AGENTS.md"],
  "permission": {
    "skill": {
      "allow": ["hyperpowers/*", "*"],
      "ask": []
    }
  }
}
```

**Step 3: Commit**

```bash
git add AGENTS.md opencode.json
git commit -m "feat: add OpenCode project instructions"
```

### Task 2: Build OpenCode skill sync + README

**Files:**
- Create: `scripts/sync_opencode_skills.js`
- Create: `.opencode/skill/README.md`

**Step 1: Implement sync script**

```ts
// scan skills/*/SKILL.md or skills/*/skill.md
// derive slug name
// write .opencode/skill/<slug>/SKILL.md with frontmatter + body
// validate name regex and description
```

**Step 2: Add generated README**

```markdown
# OpenCode Skills

This directory is generated from `skills/*/SKILL.md`.
Run `node scripts/sync_opencode_skills.js` to regenerate.
```

**Step 3: Run sync script**

```bash
node scripts/sync_opencode_skills.js
```

**Step 4: Commit**

```bash
git add scripts/sync_opencode_skills.js .opencode/skill

git commit -m "feat: generate OpenCode skills"
```

### Task 3: Add OpenCode commands

**Files:**
- Create: `.opencode/command/hp-brainstorm.md`
- Create: `.opencode/command/hp-write-plan.md`
- Create: `.opencode/command/hp-execute-plan.md`
- Create: `.opencode/command/hp-review.md`
- Create: `.opencode/command/hp-finish.md`

**Step 1: Create command files**

```markdown
---
description: Start Hyperpowers brainstorming flow
---
Use the OpenCode `skill` tool to load `brainstorming` and follow it exactly.
```

**Step 2: Commit**

```bash
git add .opencode/command

git commit -m "feat: add OpenCode commands"
```

### Task 4: Add OpenCode agents

**Files:**
- Create: `.opencode/agent/code-reviewer.md`
- Create: `.opencode/agent/codebase-investigator.md`
- Create: `.opencode/agent/internet-researcher.md`
- Create: `.opencode/agent/test-runner.md`

**Step 1: Define agent frontmatter and prompts**

```markdown
---
description: Review implementation against requirements
mode: subagent
---
You are the code-reviewer. No write/edit/bash. Focus on requirements, diffs, and risks.
```

**Step 2: Commit**

```bash
git add .opencode/agent

git commit -m "feat: add OpenCode agent definitions"
```

### Task 5: Add OpenCode plugin

**Files:**
- Create: `.opencode/plugin/hyperpowers.ts`
- Create: `.opencode/package.json`

**Step 1: Implement plugin**

```ts
import { definePlugin } from "@opencode-ai/plugin";

export default definePlugin((client) => {
  const touched = new Set<string>();

  client.on("file.edited", (event) => {
    if (event?.path) touched.add(event.path);
  });

  client.on("assistant.response", () => {
    if (touched.size > 5) {
      client.app.log("Consider committing your changes.");
    }
  });
});
```

**Step 2: Commit**

```bash
git add .opencode/plugin .opencode/package.json

git commit -m "feat: add OpenCode plugin with reminders"
```

### Task 6: Add OpenCode docs

**Files:**
- Create: `docs/README.opencode.md`
- Modify: `README.md`

**Step 1: Write OpenCode README**

```markdown
# Hyperpowers for OpenCode

## Project-local install
Copy `.opencode/` and `opencode.json` into your repo.

## Global install
Copy to `~/.config/opencode/` paths.

## Verify
- `/hp-brainstorm`
- `skill` shows Hyperpowers skills
- `@test-runner` runs tests
```

**Step 2: Link from root README**

Add an "OpenCode" section with link to `docs/README.opencode.md`.

**Step 3: Commit**

```bash
git add docs/README.opencode.md README.md

git commit -m "docs: add OpenCode usage guide"
```

### Task 7: Add validation + CI

**Files:**
- Create: `scripts/validate_opencode.js`
- Create: `.github/workflows/opencode-validate.yml`

**Step 1: Implement validator**

```ts
// verify skill folder names, frontmatter fields, command frontmatter
// fail with non-zero exit code when invalid
```

**Step 2: Add GitHub Action**

```yaml
name: OpenCode Validate
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node scripts/validate_opencode.js
```

**Step 3: Commit**

```bash
git add scripts/validate_opencode.js .github/workflows/opencode-validate.yml

git commit -m "ci: validate OpenCode assets"
```

### Task 8: Run validation locally

**Files:**
- None

**Step 1: Run validator**

```bash
node scripts/validate_opencode.js
```

**Step 2: Commit (if needed)**

```bash
git add .opencode/skill
git commit -m "chore: sync OpenCode skills"
```
