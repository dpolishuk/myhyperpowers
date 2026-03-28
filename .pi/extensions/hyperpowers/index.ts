/**
 * Hyperpowers extension for Pi coding agent (pi.dev)
 *
 * Registers all hyperpowers skills as slash commands and provides
 * memsearch long memory integration via session_start hook.
 */

import { readFileSync, existsSync } from "node:fs"
import { execSync } from "node:child_process"
import { join, resolve } from "node:path"

// Resolve the hyperpowers repo root (extension is at .pi/extensions/hyperpowers/)
const EXTENSION_DIR = import.meta.dir ?? __dirname
const REPO_ROOT = resolve(EXTENSION_DIR, "..", "..", "..")

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
  // Try multiple locations for skill files
  const paths = [
    join(REPO_ROOT, "skills", skillName, "SKILL.md"),
    join(REPO_ROOT, "skills", `${skillName}`, "SKILL.md"),
  ]

  for (const p of paths) {
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
    const projectName = cwd.split("/").pop() || "project"
    const result = execSync(
      `timeout 5 memsearch search "recent work on ${projectName}" --top-k 5 --format compact 2>/dev/null || true`,
      { cwd, encoding: "utf8", timeout: 6000 },
    )
    if (result.trim() && !result.startsWith("No results")) {
      return result.trim()
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
        { "id": "qwen2.5-coder:7b", "name": "Qwen 2.5 Coder 7B" },
        { "id": "deepseek-coder-v2:16b", "name": "DeepSeek Coder V2" }
      ]
    }
  }
}
\`\`\`

### Custom OpenAI-compatible API
\`\`\`json
{
  "providers": {
    "my-proxy": {
      "baseUrl": "https://your-proxy.example.com/v1",
      "api": "openai-completions",
      "apiKey": "your-key",
      "models": [
        { "id": "model-name", "name": "Display Name", "contextWindow": 128000 }
      ]
    }
  }
}
\`\`\`

## Tips
- Switch models during session: \`/model\` or \`Ctrl+L\`
- Use fast models for routine tasks, capable models for complex reasoning
- Set \`"reasoning": true\` for models that support extended thinking
- Set \`"cost"\` to track token spending

## Recommended Setup for Hyperpowers
- **Main model**: Claude Sonnet 4.5 or GPT-5.1 (balanced)
- **Fast tasks**: Claude Haiku 4.5 or local Ollama model
- **Complex reasoning**: Claude Opus 4.5 with \`"reasoning": true\`

Write your config to \`~/.pi/agent/models.json\` and restart Pi to apply.`
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
