const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

test("model configuration docs define direct agent routing as the canonical OpenCode contract", () => {
  const docs = read("docs/model-configuration.md")

  assert.equal(docs.includes("direct agent→model mapping"), true)
  assert.equal(docs.includes("`agent.<agent>.model`"), true)
  assert.equal(docs.includes('"agents": {'), false)
  assert.equal(docs.includes("plugin/options edit the same underlying map"), true)
  assert.equal(docs.includes("planned extension"), true)
  assert.equal(docs.includes("When implemented, the intended workflow override precedence is:"), true)
  assert.equal(docs.includes("1. Explicit workflow override for the concrete agent"), true)
  assert.equal(docs.includes("2. Global `agent.<agent>.model` mapping"), true)
})

test("OpenCode install docs describe config and plugin options as peers over one routing map", () => {
  const installDoc = read(".opencode/INSTALL.md")

  assert.equal(installDoc.includes("agent→model"), true)
  assert.equal(installDoc.includes("plugin/options"), true)
  assert.equal(installDoc.includes("same underlying map"), true)
  assert.equal(installDoc.includes("cp docs/opencode.example.agent-routing.json opencode.json"), true)
  assert.equal(installDoc.includes("planned Hyperpowers extension"), true)
})

test("dedicated OpenCode agent-routing example exists with global defaults and workflow overrides", () => {
  const examplePath = path.join(repoRoot, "docs", "opencode.example.agent-routing.json")
  assert.equal(fs.existsSync(examplePath), true)

  const example = JSON.parse(fs.readFileSync(examplePath, "utf8"))
  assert.ok(example.agent)
  assert.equal(example.agents, undefined)
  assert.equal(typeof example.agent.ralph.model, "string")
  assert.equal(typeof example.agent["test-runner"].model, "string")
  assert.equal(typeof example.agent["autonomous-reviewer"].model, "string")
  assert.ok(example.hyperpowers)
  assert.equal(example.hyperpowers.comment.includes("planned Hyperpowers extension"), true)
  assert.equal(typeof example.hyperpowers.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model, "string")
})

test("all OpenCode-facing examples use the canonical agent key", () => {
  for (const relativePath of [
    "docs/README.md",
    "docs/opencode.example.anthropic.json",
    "docs/opencode.example.glm.json",
    "docs/opencode.example.multi-provider.json",
  ]) {
    const text = read(relativePath)
    assert.equal(text.includes('"agents": {'), false, `${relativePath} should not use the legacy agents key`)
  }
})
