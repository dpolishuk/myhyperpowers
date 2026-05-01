const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")

const scannedRoots = [
  "agents",
  "commands",
  "skills",
  ".agents/skills",
  ".kimi/skills",
  ".kimi/agents",
  ".opencode/agents",
  ".opencode/skills",
  ".gemini-extension/agents",
  ".gemini-extension/mcp",
  "README.md",
  "AGENTS.md",
]

const allowedFiles = new Set([
  // Explicit legacy/backend adapter implementation, not normal agent workflow prompts.
  ".gemini-extension/mcp/bd-server.js",
])

const forbiddenCommandPattern = /(?:^|[\s`])(?<cmd>bd\s+(?:ready|blocked|show|update|edit|close|create|dep)|br\s+(?:create|dep|sync))\b/gm

function* walk(entry) {
  const fullPath = path.join(repoRoot, entry)
  if (!fs.existsSync(fullPath)) return
  const stat = fs.statSync(fullPath)
  if (stat.isFile()) {
    yield entry
    return
  }
  for (const child of fs.readdirSync(fullPath)) {
    const relative = path.join(entry, child)
    const childStat = fs.statSync(path.join(repoRoot, relative))
    if (childStat.isDirectory()) yield* walk(relative)
    else if (/\.(md|js|ts|json|yaml|toml)$/.test(child)) yield relative
  }
}

test("normal XPowers prompt surfaces do not contain executable direct bd/br task commands", () => {
  const violations = []

  for (const root of scannedRoots) {
    for (const relativePath of walk(root)) {
      const normalized = relativePath.split(path.sep).join("/")
      if (allowedFiles.has(normalized)) continue

      const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8")
      const lines = content.split(/\r?\n/)
      for (const [index, line] of lines.entries()) {
        forbiddenCommandPattern.lastIndex = 0
        const match = forbiddenCommandPattern.exec(line)
        if (!match) continue
        violations.push(`${normalized}:${index + 1}: ${match.groups.cmd} — use tm or add an explicit backend-specific allowlist entry`)
      }
    }
  }

  assert.deepEqual(violations, [])
})
