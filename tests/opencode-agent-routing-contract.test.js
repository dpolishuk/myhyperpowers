const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

test("model configuration docs define direct agent routing as the canonical OpenCode contract", () => {
  const docs = read("docs/model-configuration.md")

  assert.equal(docs.includes("direct agent→model mapping"), true)
  assert.equal(docs.includes("`agents.<agent>.model`"), true)
  assert.equal(docs.includes("plugin/options edit the same underlying map"), true)
  assert.equal(docs.includes("workflow override precedence"), true)
})

test("OpenCode install docs describe config and plugin options as peers over one routing map", () => {
  const installDoc = read(".opencode/INSTALL.md")

  assert.equal(installDoc.includes("agent→model"), true)
  assert.equal(installDoc.includes("plugin/options"), true)
  assert.equal(installDoc.includes("same underlying map"), true)
})

test("dedicated OpenCode agent-routing example exists with global defaults and workflow overrides", () => {
  const examplePath = path.join(repoRoot, "docs", "opencode.example.agent-routing.json")
  assert.equal(fs.existsSync(examplePath), true)

  const example = JSON.parse(fs.readFileSync(examplePath, "utf8"))
  assert.ok(example.agents)
  assert.ok(example.agents.ralph)
  assert.ok(example.agents["test-runner"])
  assert.ok(example.hyperpowers)
  assert.ok(example.hyperpowers.workflowOverrides)
})
