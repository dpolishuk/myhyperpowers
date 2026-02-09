const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")

test("README documents codex sync write/check workflow", () => {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8")

  assert.equal(readme.includes("node scripts/sync-codex-skills.js --write"), true)
  assert.equal(readme.includes("node scripts/sync-codex-skills.js --check"), true)
  assert.equal(readme.includes(".codex/skills"), true)
})

test("Codex docs include explicit $codex-* invocation examples", () => {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8")
  const codexInstall = fs.readFileSync(path.join(repoRoot, ".codex", "INSTALL.md"), "utf8")

  assert.equal(readme.includes("$codex-command-write-plan"), true)
  assert.equal(readme.includes("$codex-command-execute-plan"), true)
  assert.equal(readme.includes("$codex-skill-executing-plans"), true)

  assert.equal(codexInstall.includes("$codex-command-write-plan"), true)
  assert.equal(codexInstall.includes("$codex-command-execute-plan"), true)
  assert.equal(codexInstall.includes("$codex-skill-executing-plans"), true)
})

test("Codex docs define skills identity and /skills discovery path", () => {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8")
  const codexInstall = fs.readFileSync(path.join(repoRoot, ".codex", "INSTALL.md"), "utf8")

  assert.equal(readme.includes("/skills"), true)
  assert.equal(codexInstall.includes("/skills"), true)
  assert.equal(codexInstall.includes("wrappers are skills"), true)
})

test("Codex docs do not claim custom slash-command registration", () => {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8")
  const codexInstall = fs.readFileSync(path.join(repoRoot, ".codex", "INSTALL.md"), "utf8")

  assert.equal(codexInstall.includes("not custom slash-command registrations"), true)
  assert.equal(readme.includes("not custom slash-command registration"), true)
})

test("AGENTS guide documents codex wrapper regeneration contract", () => {
  const agentsGuide = fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8")

  assert.equal(agentsGuide.includes("node scripts/sync-codex-skills.js --write"), true)
  assert.equal(agentsGuide.includes("node scripts/sync-codex-skills.js --check"), true)
  assert.equal(agentsGuide.includes("Do not hand-edit generated `codex-*` directories directly."), true)
})
