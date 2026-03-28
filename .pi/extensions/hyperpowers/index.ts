/**
 * Hyperpowers extension for Pi coding agent (pi.dev)
 *
 * Registers all hyperpowers skills as slash commands, provides
 * memsearch long memory integration, and subagent delegation tool.
 */

import { readFileSync, existsSync } from "node:fs"
import { execFileSync, spawnSync } from "node:child_process"
import { join, resolve, basename } from "node:path"
import { Type } from "@sinclair/typebox"

// Resolve skill paths: try extension-local skills first, then repo root
const EXTENSION_DIR = import.meta.dir ?? __dirname
const SKILLS_DIRS = [
  join(EXTENSION_DIR, "skills"),                        // installed: ~/.pi/agent/extensions/hyperpowers/skills/
  resolve(EXTENSION_DIR, "..", "..", "..", "skills"),    // dev: repo root skills/
]

// Skills to register as slash commands
const SKILLS = [
  { command: "brainstorm", skill: "brainstorming", description: "Interactive design refinement using Socratic questioning" },
  { command: "write-plan", skill: "writing-plans", description: "Create detailed implementation plan with bite-sized tasks" },
  { command: "execute-plan", skill: "executing-plans", description: "Execute plan in batches with review checkpoints" },
  { command: "execute-ralph", skill: "execute-ralph", description: "Execute entire epic autonomously without stopping" },
  { command: "review-impl", skill: "review-implementation", description: "Verify implementation matches requirements" },
  { command: "recall", skill: "recall", description: "Search long-term memory from previous sessions" },
  { command: "refactor", skill: "refactoring-safely", description: "Refactor code with tests staying green" },
  { command: "fix-bug", skill: "fixing-bugs", description: "Systematic bug fixing workflow" },
  { command: "debug", skill: "debugging-with-tools", description: "Systematic debugging using debuggers and agents" },
  { command: "tdd", skill: "test-driven-development", description: "Test-driven development: RED-GREEN-REFACTOR" },
  { command: "analyze-tests", skill: "analyzing-test-effectiveness", description: "Audit test quality for tautological tests" },
  { command: "verify", skill: "verification-before-completion", description: "Verify work before claiming complete" },
  { command: "routing-settings", skill: "routing-settings", description: "Configure agent model routing" },
]

function loadSkillContent(skillName: string): string | null {
  for (const dir of SKILLS_DIRS) {
    const p = join(dir, skillName, "SKILL.md")
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf8")
      } catch {
        continue
      }
    }
  }
  return null
}

function recallMemories(cwd: string): string | null {
  try {
    const projectName = basename(cwd) || "project"
    // Use spawnSync with argv array to avoid shell injection
    const result = spawnSync("memsearch", ["search", `recent work on ${projectName}`, "--top-k", "5", "--format", "compact"], {
      cwd,
      encoding: "utf8",
      timeout: 5000,
    })
    const output = result.stdout?.trim() || ""
    if (output && !output.startsWith("No results")) {
      return output
    }
  } catch {
    // memsearch not installed or failed — skip silently
  }
  return null
}

export default function (pi: any) {
  // Register each skill as a slash command
  for (const { command, skill, description } of SKILLS) {
    pi.registerCommand(command, {
      description,
      handler: async (_args: unknown, ctx: any) => {
        const content = loadSkillContent(skill)
        if (content) {
          return content
        }
        return `Skill "${skill}" not found. Make sure hyperpowers is installed correctly.`
      },
    })
  }

  // Model setup wizard — generates ~/.pi/agent/models.json
  pi.registerCommand("setup-models", {
    description: "Configure Pi model providers (Anthropic, OpenAI, Ollama, etc.)",
    handler: async (_args: unknown, ctx: any) => {
      return `# Pi Model Setup

To configure your AI model providers, edit \`~/.pi/agent/models.json\`.

## Quick Setup Examples

### Anthropic (Claude)
No config needed — built-in. Just set \`ANTHROPIC_API_KEY\` env var.

### OpenAI
No config needed — built-in. Just set \`OPENAI_API_KEY\` env var.

### Ollama (local models, free)
\`\`\`json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b", "name": "Llama 3.1 8B" },
        { "id": "qwen2.5-coder:7b", "name": "Qwen 2.5 Coder 7B" }
      ]
    }
  }
}
\`\`\`

## Tips
- Switch models during session: \`/model\` or \`Ctrl+L\`
- Set \`"reasoning": true\` for models that support extended thinking
- Set \`"cost"\` to track token spending

Write your config to \`~/.pi/agent/models.json\` and restart Pi to apply.`
    },
  })

  // Subagent tool — delegates tasks to isolated Pi subprocess
  pi.registerTool({
    name: "hyperpowers_subagent",
    label: "Subagent",
    description: "Delegate a task to an isolated Pi subagent. Runs in a separate process with its own context. Use for code review, test running, research, or any task benefiting from isolated context.",
    parameters: Type.Object({
      task: Type.String({ description: "The task for the subagent to perform" }),
    }),
    async execute(params: { task: string }) {
      try {
        // Use spawnSync with argv array to prevent shell injection
        const result = spawnSync("pi", ["--print", "--", params.task], {
          encoding: "utf8",
          timeout: 120000,
          maxBuffer: 1024 * 1024 * 10,
          cwd: process.cwd(),
        })
        const output = result.stdout?.trim() || ""
        if (result.status !== 0) {
          return {
            content: [{ type: "text" as const, text: `Subagent failed (exit ${result.status}): ${result.stderr?.trim() || output || "unknown error"}` }],
          }
        }
        return {
          content: [{ type: "text" as const, text: output || "(subagent returned empty result)" }],
        }
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Subagent failed: ${err.message || String(err)}` }],
        }
      }
    },
  })

  // Parallel review — dispatches multiple subagents
  pi.registerCommand("review-parallel", {
    description: "Run 3 parallel review subagents: quality, implementation, simplification",
    handler: async (_args: unknown, ctx: any) => {
      return `# Parallel Review

Run these 3 reviews using the hyperpowers_subagent tool IN PARALLEL:

1. **Quality review**: Use hyperpowers_subagent with task:
   "Review the recent code changes for bugs, security issues, and race conditions. Check git diff HEAD~1. Return PASS or ISSUES_FOUND with file:line references."

2. **Implementation review**: Use hyperpowers_subagent with task:
   "Verify the recent changes achieve their stated goals. Check git log --oneline -5 for context. Return PASS or ISSUES_FOUND with missing items."

3. **Simplification review**: Use hyperpowers_subagent with task:
   "Check for over-engineering in recent changes. Look for unnecessary abstractions. Return PASS or ISSUES_FOUND with recommendations."

After all 3 complete, summarize the results in a table.`
    },
  })

  // Session-aware review
  pi.registerCommand("review-branch", {
    description: "Review code in an isolated subprocess (won't affect main session)",
    handler: async (_args: unknown, ctx: any) => {
      return `# Branched Review

Use the hyperpowers_subagent tool to delegate the review. The subagent runs in a completely isolated Pi process — its context won't affect your main session.

Example: Call hyperpowers_subagent with task:
"Read the files changed in the last commit (git diff HEAD~1 --name-only), then review each file for bugs, security issues, and code quality. Provide a structured report."`
    },
  })

  // Memory recall on session start
  pi.on("session_start", async (event: any) => {
    const cwd = event?.cwd || process.cwd()
    const memories = recallMemories(cwd)
    if (memories) {
      return {
        context: `## Long-term Memory (memsearch)\nThe following memories from previous sessions may be relevant:\n\n${memories}\n\nUse these as background context. Do not repeat them unless asked.`,
      }
    }
  })
}
