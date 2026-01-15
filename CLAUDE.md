# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Hyperpowers is a Claude Code plugin that provides structured workflows, best practices, and specialized agents for software development. It's a plugin system that adds skills (reusable workflows), slash commands (quick access to workflows), specialized agents (domain-specific task handlers), and hooks (automatic behaviors).

Inspired by [obra/superpowers](https://github.com/obra/superpowers).

## CRITICAL: Understanding User Requests in This Repository

**This is a plugin development project.** Your task is to improve the plugin (skills, hooks, agents, commands), NOT to debug the user's other projects.

### Common Pattern: Examples from Other Sessions

The user will frequently describe issues like:
- "Claude did X in another session and it was wrong"
- "I got this error: [some error from another project]"
- "Claude truncated the bd task and that caused problems"
- "Claude edited .git/hooks/pre-commit with sed"

**CRITICAL - These are NOT problems for you to investigate or debug.**

### What These Examples Actually Mean

When the user describes an issue from another session, they are:
1. **Providing evidence** of a pattern where Claude behaves incorrectly
2. **Requesting plugin improvements** to prevent that pattern
3. **NOT asking you** to fix those specific historical errors

### The Correct Response Pattern

**Bad response (trying to fix the other session):**
```
Let me investigate that error. Can you show me the file where the truncation occurred?
Let me check the bd task that was created. What was the full command?
```

**Good response (improving the plugin):**
```
This is a pattern we can prevent with a hook. Let me create a PostToolUse hook
that blocks bd commands containing truncation markers.
```

### Translation Guide

| What user says | What they actually want |
|----------------|------------------------|
| "Claude truncated the bd task" | Create hook to block bd truncation |
| "Claude edited pre-commit with sed" | Create hook to block pre-commit modifications |
| "The test-runner agent didn't activate" | Improve skill-rules.json triggers |
| "Claude ignored the skill" | Improve skill description or add hook |
| "This caused incomplete implementation" | Add blocking hook to prevent pattern |

### Your Goal in This Repository

**Always:** Improve the plugin to prevent bad patterns
**Never:** Try to investigate or fix issues from other sessions

You cannot access other sessions. You cannot fix past problems. You CAN prevent those problems from happening again by improving skills, hooks, agents, and commands in THIS repository.

### Examples of Correct Responses

**User:** "Claude edited .git/hooks/pre-commit with `sed -i` to work around an error"

**Correct response:**
- Create PreToolUse hook blocking Edit/Write to pre-commit
- Create PostToolUse hook blocking Bash commands modifying pre-commit
- Update HOOKS.md with documentation

**User:** "The bd task had '[Remaining steps truncated]' which caused incomplete implementation"

**Correct response:**
- Create PostToolUse hook blocking bd create/update with truncation markers
- Add regex patterns for all truncation variations
- Test hook with sample commands

**User:** "Claude ran `./scripts/docker-test.sh` with 700+ lines of output and didn't suggest test-runner agent"

**Correct response:**
- Add test script patterns to skill-rules.json
- Add keywords like "npm test", "pytest", test runner names
- Test activation with sample prompts

## Plugin Structure

The repository is organized as follows:

- **skills/** - Reusable workflow definitions (each in its own directory with SKILL.md)
- **commands/** - Slash command definitions that invoke skills
- **agents/** - Specialized subagent prompts (code-reviewer, codebase-investigator, internet-researcher, test-runner)
- **hooks/** - Automatic behaviors triggered by events
- **.claude-plugin/** - Plugin metadata (plugin.json)

## Key Architecture Concepts

### Skills System

Skills are detailed workflow instructions stored in `skills/*/SKILL.md`. Each skill follows a specific pattern:

1. **Frontmatter** - YAML metadata (name, description)
2. **Overview** - Core principle and context
3. **The Process** - Step-by-step workflow with exact commands
4. **Common Rationalizations** - Mistakes to avoid
5. **Red Flags** - Anti-patterns to prevent
6. **Integration** - How this skill calls/is called by others

**Critical distinction:**
- Some skills are **rigid processes** (TDD, verification) - follow exactly, no adaptation
- Some skills are **flexible patterns** (architecture, naming) - adapt principles to context
- The skill itself tells you which type it is

### Skill Invocation Pattern

Skills are invoked through slash commands that expand to prompts. The flow is:

1. User types `/hyperpowers:write-plan`
2. Command file (`commands/write-plan.md`) expands with instruction: "Use the writing-plans skill exactly as written"
3. Claude uses the Skill tool to load `skills/writing-plans/SKILL.md`
4. Claude follows the skill's detailed instructions

### GitHub Projects Integration

Many skills integrate with `gh project` (GitHub Projects CLI). The workflows expect:

- **Epics** - High-level features/initiatives (created by writing-gh-plans)
- **Tasks** - Specific implementation steps (created by writing-gh-plans, executed by executing-gh-plans)
- **Epic Field** - Custom TEXT field linking tasks to their epic
- **Status Field** - SINGLE_SELECT with options: To Do, In Progress, Blocked, Done
- **Priority Field** - SINGLE_SELECT with options: P0, P1, P2, P3
- **Project Context** - Cached in `hooks/context/gh-project.json` for fast ID access

**Project configuration:**
- Each repository has ONE working GitHub Project
- Run `/hyperpowers:set-gh-project` to configure project
- Cache includes: repo, owner, projectNumber, projectId, field IDs, option IDs

Common gh project commands:
```bash
# Requires project context to be configured first
gh project item-create <PROJECT_NUMBER> --owner <OWNER> --title "..." --body "..." --format json
gh project item-edit --id <ITEM_ID> --project-id <PROJECT_ID> --field-id <FIELD_ID> --text "..."
gh project item-list <PROJECT_NUMBER> --owner <OWNER> --format json | jq '.'
gh project field-list <PROJECT_NUMBER> --owner <OWNER> --format json
```

### Agent System

Specialized agents run in separate contexts to handle specific tasks:

1. **test-runner** (uses Haiku) - Runs tests/hooks/commits, returns only summary + failures to keep context clean
2. **code-reviewer** - Reviews implementations against plans and coding standards
3. **codebase-investigator** - Explores codebase state and patterns when planning/designing
4. **internet-researcher** - Researches APIs, libraries, docs when planning/designing

**Critical pattern:** Agents keep verbose output (test results, formatting diffs) in their own context, returning only essential info to the main conversation.

### Common Patterns Location

To avoid duplication, common elements are centralized in `skills/common-patterns/`:

- `bd-commands.md` - Standard bd command examples
- `common-anti-patterns.md` - Anti-patterns to avoid
- `common-rationalizations.md` - Excuses that signal failure

Skills reference these rather than duplicating content.

## Core Workflows

### Feature Development (Greenfield)

Complete workflow from idea to PR:

1. **Brainstorming** (`/hyperpowers:brainstorm`) - Socratic questioning to refine requirements
2. **SRE Task Refinement** (optional) - Uses Opus 4.1 to identify corner cases
3. **Writing Plans** (`/hyperpowers:write-gh-plan`) - Creates GitHub Project epic with linked tasks
4. **Executing Plans** (`/hyperpowers:execute-gh-plan`) - Implements tasks continuously, updating GitHub Project status
5. **Review Implementation** (`/hyperpowers:review-implementation`) - Verifies against spec
6. **Finishing Branch** - Creates PR, handles cleanup

### Test-Driven Development

Required for most implementation work:

1. Write test first (RED phase)
2. Watch test fail (verifies test actually tests something)
3. Write minimal code to pass (GREEN phase)
4. Refactor while keeping tests green
5. Commit

The `test-driven-development` skill enforces this rigorously.

### Bug Fixing & Debugging

Complete workflow for fixing bugs systematically:

1. **Create GitHub Project Task** - Track the bug with reproduction steps in GitHub Project
2. **Debugging with Tools** - Use debuggers, internet-researcher, codebase-investigator to find root cause
3. **Write Failing Test** (RED phase) - Reproduce the bug in a test
4. **Implement Fix** (GREEN phase) - Minimal fix addressing root cause
5. **Verify** - Run full test suite via test-runner agent, check for regressions
6. **Close Task** - Document fix and mark as Done in GitHub Project

**Key Skills:**
- `debugging-with-tools` - Systematic investigation using debuggers, internet research, and agents
- `root-cause-tracing` - Trace backward through call stack to find original trigger
- `managing-gh-projects` - For creating/updating bug tasks

**Critical:** Always use debugger and internet-researcher BEFORE attempting fixes. Never fix symptoms.

### Verification Pattern

Before claiming any work is complete:

1. Run verification commands (tests, lints, builds)
2. Capture output as evidence
3. Only claim success if verification passes
4. Use test-runner agent to avoid context pollution

The `verification-before-completion` skill makes this mandatory.

## Development Commands

This is a plugin repository with no build system - it's pure markdown files. There are no tests, linters, or build commands.

### Testing Skills

When creating or modifying skills, use the `writing-skills` skill which applies TDD to documentation:

1. Test skill with subagents BEFORE writing final version
2. Iterate until the skill is bulletproof against rationalization
3. Document what failure modes you tested

### Publishing

The plugin is published to the Claude Code marketplace:

```bash
# In the marketplace system (not in this repo)
claude-code plugins install withzombies-hyper/hyperpowers
```

Version is tracked in `.claude-plugin/plugin.json`.

## Philosophy and Principles

From the using-hyper skill and README:

1. **Incremental progress over big bangs** - Small changes that compile and pass tests
2. **Learning from existing code** - Study patterns before implementing
3. **Explicit workflows over implicit assumptions** - Make the process visible
4. **Verification before completion** - Evidence over assertions
5. **Test-driven when possible** - Red, green, refactor

### Mandatory Workflows

The `using-hyper` skill establishes these non-negotiable rules:

- **Check for relevant skills before ANY task** - If a skill exists for it, use it
- **Use Skill tool before announcing** - Load the actual skill file, don't rely on memory
- **Create TodoWrite todos for checklists** - Track progress explicitly
- **Follow brainstorming before coding** - Design first, code second
- **Use verification-before-completion** - Never claim success without evidence

## Common Pitfalls

From `using-hyper` - watch for these rationalizations:

- "This is just a simple question" → Wrong. Check for skills.
- "I can check git/files quickly" → Wrong. Files lack context. Check for skills.
- "Let me gather information first" → Wrong. Skills tell you HOW to gather.
- "This doesn't need a formal skill" → Wrong. If skill exists, use it.
- "I remember this skill" → Wrong. Skills evolve. Run current version.
- "The skill is overkill" → Wrong. Skills exist because simple things become complex.

## Current Limitations

**Currently covered:**
- ✅ Greenfield feature development (idea → design → implementation → PR)
- ✅ Bug fixing and debugging workflows (systematic investigation, root cause tracing)
- ✅ Refactoring workflows (test-preserving transformations)
- ✅ Advanced task management (splitting, merging, dependencies, metrics)
- ✅ Quality culture (TDD, verification, SRE review)
- ✅ Clean GitHub Projects integration

**Missing:**
- ❌ Incident response
- ❌ Code review response (receiving reviews)
- ❌ Merge conflict resolution
- ❌ Documentation workflows

Priority: Continue adding collaboration workflows (code review response, incidents).

## File Naming Conventions

- Skills: `skills/<skill-name>/SKILL.md` (frontmatter + content)
- Commands: `commands/<command-name>.md` (frontmatter + brief invocation)
- Agents: `agents/<agent-name>.md` (frontmatter + detailed prompt)
- Common patterns: `skills/common-patterns/<pattern-name>.md`

## Important Notes

- This plugin is loaded automatically when installed; there's no runtime execution
- Skills are documentation that Claude reads at runtime, not executable code
- Changes to skill files take effect immediately in new conversations
- The test-runner agent uses Haiku model for cost efficiency
- The sre-task-refinement skill uses Opus 4.1 for deep analysis
- Most other operations use the default model (Sonnet)

## Contributing Guidelines

From writing-skills skill:

1. Test skills with subagents before finalizing
2. Iterate until bulletproof against rationalization
3. Follow the skill structure pattern (Overview, Process, Rationalizations, Red Flags, Integration)
4. Reference common-patterns instead of duplicating content
5. Be explicit about whether skill is rigid (must follow exactly) or flexible (adapt principles)
