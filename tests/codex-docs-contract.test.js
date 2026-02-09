const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")

test("README documents codex sync write/check workflow", () => {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8")

  assert.equal(readme.includes("node scripts/sync-codex-skills.js --write"), true)
  assert.equal(readme.includes("node scripts/sync-codex-skills.js --check"), true)
  assert.equal(readme.includes(".agents/skills"), true)
})

test("AGENTS guide documents codex wrapper regeneration contract", () => {
  const agentsGuide = fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8")

  assert.equal(agentsGuide.includes("node scripts/sync-codex-skills.js --write"), true)
  assert.equal(agentsGuide.includes("node scripts/sync-codex-skills.js --check"), true)
  assert.equal(agentsGuide.includes("Do not hand-edit generated `codex-*` directories directly."), true)
})
