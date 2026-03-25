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
  assert.equal(docs.includes("resolved at runtime for Hyperpowers task-tool dispatch paths"), true)
  assert.equal(docs.includes("The active override precedence is:"), true)
  assert.equal(docs.includes("1. Explicit workflow override for the concrete agent"), true)
  assert.equal(docs.includes("2. Global `agent.<agent>.model` mapping"), true)
  assert.equal(docs.includes("4. Agent frontmatter `model`"), true)
  assert.equal(docs.includes("5. Provider default"), true)
})

test("OpenCode install docs describe config and plugin options as peers over one routing map", () => {
  const installDoc = read(".opencode/INSTALL.md")

  assert.equal(installDoc.includes("agent→model"), true)
  assert.equal(installDoc.includes("plugin/options"), true)
  assert.equal(installDoc.includes("same underlying map"), true)
  assert.equal(installDoc.includes("cp docs/opencode.example.agent-routing.json opencode.json"), true)
  assert.equal(installDoc.includes("active for Hyperpowers task-tool dispatch paths"), true)
  assert.equal(installDoc.includes("hyperpowers_agent_routing_config"), true)
  assert.equal(installDoc.includes("agent-routing-config.ts"), true)
})

test("dedicated OpenCode agent-routing example exists with global defaults and workflow overrides", () => {
  const examplePath = path.join(repoRoot, "docs", "opencode.example.agent-routing.json")
  assert.equal(fs.existsSync(examplePath), true)

  const example = JSON.parse(fs.readFileSync(examplePath, "utf8"))
  assert.ok(example.agent)
  assert.equal(example.agents, undefined)
  assert.equal(typeof example.agent.ralph.model, "string")
  assert.equal(typeof example.agent["test-runner"].model, "string")
  assert.equal(typeof example.agent["code-reviewer"].model, "string")
  assert.equal(typeof example.agent["review-testing"].model, "string")
  assert.equal(typeof example.agent["review-documentation"].model, "string")
  assert.equal(typeof example.agent["autonomous-reviewer"].model, "string")
  assert.ok(example.hyperpowers)
  assert.equal(example.hyperpowers.comment.includes("active for Hyperpowers task-tool dispatch paths"), true)
  assert.equal(typeof example.hyperpowers.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model, "string")
})

test("all OpenCode-facing examples use the canonical agent key", () => {
  for (const relativePath of [
    "docs/README.md",
    "docs/opencode.example.inherit.json",
    "docs/opencode.example.anthropic.json",
    "docs/opencode.example.glm.json",
    "docs/opencode.example.multi-provider.json",
  ]) {
    const text = read(relativePath)
    assert.equal(text.includes('"agents": {'), false, `${relativePath} should not use the legacy agents key`)
  }
})

test("all explicit-routing OpenCode examples parse with the canonical agent key", () => {
  for (const relativePath of [
    "docs/opencode.example.anthropic.json",
    "docs/opencode.example.glm.json",
    "docs/opencode.example.multi-provider.json",
  ]) {
    const example = JSON.parse(read(relativePath))
    assert.ok(example.agent, `${relativePath} should define agent mappings`)
    assert.equal(example.agents, undefined, `${relativePath} should not use the legacy agents key`)
  }
})

test("OpenCode docs README matches the canonical precedence and examples list", () => {
  const docsReadme = read("docs/README.md")
  const modelConfig = read("docs/model-configuration.md")

  assert.equal(
    docsReadme.includes("1. `opencode.json` → `hyperpowers.workflowOverrides.<workflow>.<name>.model` (highest)"),
    true,
  )
  assert.equal(docsReadme.includes("2. `opencode.json` → `agent.<name>.model`"), true)
  assert.equal(docsReadme.includes("3. `opencode.json` → top-level `model`"), true)
  assert.equal(docsReadme.includes("4. Agent frontmatter → `model` field"), true)
  assert.equal(docsReadme.includes("opencode.example.agent-routing.json"), true)
  assert.equal(docsReadme.includes("cp docs/opencode.example.inherit.json opencode.json"), true)
  assert.equal(docsReadme.includes("canonical `agent` key"), true)
  assert.equal(docsReadme.includes("same underlying routing map"), true)
  assert.equal(docsReadme.includes("active `hyperpowers.workflowOverrides` shape"), true)
  assert.equal(docsReadme.includes("hyperpowers_agent_routing_config"), true)
  assert.equal(docsReadme.includes("/models"), true)
  assert.equal(modelConfig.includes("/models"), true)
})

test("OpenCode plugin source includes the routing config tool plugin", () => {
  const pluginPath = path.join(repoRoot, ".opencode", "plugins", "agent-routing-config.ts")
  assert.equal(fs.existsSync(pluginPath), true)

  const pluginSource = fs.readFileSync(pluginPath, "utf8")
  assert.equal(pluginSource.includes("hyperpowers_agent_routing_config"), true)
  assert.equal(pluginSource.includes("opencode.json"), true)
})

test("inherit example points users to the canonical agent key", () => {
  const inheritExample = read("docs/opencode.example.inherit.json")

  assert.equal(inheritExample.includes("'agents' section"), false)
  assert.equal(inheritExample.includes("'agent' section"), true)
  assert.equal((inheritExample.match(/"comment":/g) || []).length, 1)
})

test("model configuration intro matches the documented four methods", () => {
  const docs = read("docs/model-configuration.md")

  assert.equal(docs.includes("1. **Agent Frontmatter** - Set default model in the agent definition"), true)
  assert.equal(docs.includes("2. **OpenCode Config** - Override per-agent models in `opencode.json`"), true)
  assert.equal(docs.includes("3. **Multiple Providers with Same Models** - Route different concrete agents across providers"), true)
  assert.equal(docs.includes("4. **Claude Code Configuration** - Host-specific model configuration"), true)
})
