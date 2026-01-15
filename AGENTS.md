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
