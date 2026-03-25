const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

test("README presents tm as the canonical task-management interface", () => {
  const readme = read("README.md")

  assert.equal(readme.includes("canonical user-facing task-management interface"), true)
  assert.equal(readme.includes("tm-first"), true)
  assert.equal(readme.includes("bd` / `br` / `tk`"), true)
  assert.equal(readme.includes("Linear and GitHub are integrations"), true)
})

test("AGENTS guide does not claim a conflicting bd-first docs model", () => {
  const agentsGuide = read("AGENTS.md")

  assert.equal(agentsGuide.includes("uses **bd (beads)** for ALL issue tracking"), false)
  assert.equal(agentsGuide.includes("tm is the canonical user-facing interface"), true)
  assert.equal(agentsGuide.includes("current backend in this repo is `bd`"), true)
})

test("Docs index surfaces the canonical tm setup and integration guides", () => {
  const docsReadme = read("docs/README.md")

  assert.equal(docsReadme.includes("tm"), true)
  assert.equal(docsReadme.includes("linear-mcp-setup.md"), true)
  assert.equal(docsReadme.includes("backend"), true)
})

test("README first-pass classifies bd br and tk with distinct roles", () => {
  const readme = read("README.md")

  assert.equal(readme.includes("`bd` = current local tracker backend in this repo"), true)
  assert.equal(readme.includes("`br` = Beads Rust"), true)
  assert.equal(readme.includes("`tk` = Ticket"), true)
  assert.equal(readme.includes("not interchangeable day-to-day commands"), true)
})
