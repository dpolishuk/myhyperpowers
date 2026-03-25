const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")
const hasLegacyAgentsKey = (text) => /"agents"\s*:/.test(text)

test("model configuration docs define direct agent routing as the canonical OpenCode contract", () => {
  const docs = read("docs/model-configuration.md")

  assert.equal(docs.includes("direct agent→model mapping"), true)
  assert.equal(docs.includes("`agent.<agent>.model`"), true)
  assert.equal(hasLegacyAgentsKey(docs), false)
  assert.equal(docs.includes("plugin/options edit the same underlying map"), true)
  assert.equal(docs.includes("resolved at runtime for Hyperpowers task-tool dispatch paths"), true)
  assert.equal(docs.includes("The active Hyperpowers-injected precedence is:"), true)
  assert.equal(docs.includes("1. Explicit workflow override for the concrete agent"), true)
  assert.equal(docs.includes("2. Global `agent.<agent>.model` mapping"), true)
  assert.equal(docs.includes("3. Agent frontmatter `model`"), true)
  assert.equal(docs.includes("4. Otherwise leave `model` unset so native OpenCode session inheritance"), true)
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
    assert.equal(hasLegacyAgentsKey(text), false, `${relativePath} should not use the legacy agents key`)
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
  assert.equal(docsReadme.includes("3. Agent frontmatter → `model` field"), true)
  assert.equal(
    docsReadme.includes("4. Otherwise leave `model` unset so native OpenCode inheritance, top-level `model`, and provider defaults can apply"),
    true,
  )
  assert.equal(docsReadme.includes("opencode.example.agent-routing.json"), true)
  assert.equal(docsReadme.includes("cp docs/opencode.example.inherit.json opencode.json"), true)
  assert.equal(docsReadme.includes("canonical `agent` key"), true)
  assert.equal(docsReadme.includes("same underlying routing map"), true)
  assert.equal(docsReadme.includes("active `hyperpowers.workflowOverrides` shape"), true)
  assert.equal(docsReadme.includes("hyperpowers_agent_routing_config"), true)
  assert.equal(docsReadme.includes("/models"), true)
  assert.equal(modelConfig.includes("/models"), true)
})

test("OpenCode plugin source registers the routing config tool and writes opencode.json", () => {
  const pluginPath = path.join(repoRoot, ".opencode", "plugins", "agent-routing-config.ts")
  assert.equal(fs.existsSync(pluginPath), true)

  const pluginSource = fs.readFileSync(pluginPath, "utf8")
  assert.equal(/hyperpowers_agent_routing_config/.test(pluginSource), true)
  assert.equal(/action\s*===\s*"get"/.test(pluginSource), true)
  assert.equal(/enum\(\["get",\s*"set"\]\)/.test(pluginSource), true)
  assert.equal(/opencode\.json/.test(pluginSource), true)
})

test("OpenCode routing settings command exists and delegates to the routing config tool", () => {
  const commandPath = path.join(repoRoot, ".opencode", "commands", "routing-settings.md")
  assert.equal(fs.existsSync(commandPath), true)

  const commandSource = fs.readFileSync(commandPath, "utf8")
  assert.equal(commandSource.includes("hyperpowers_agent_routing_config"), true)
  assert.equal(commandSource.includes("action=get"), true)
  assert.equal(commandSource.includes("action=set"), true)
  assert.equal(commandSource.includes("agent.<agent>.model"), true)
  assert.equal(commandSource.includes("hyperpowers.workflowOverrides.<workflow>.<agent>.model"), true)
  assert.equal(commandSource.includes("Never edit `opencode.json` directly"), true)
  assert.equal(commandSource.includes("no update was made"), true)
  assert.equal(commandSource.includes("unsupported agent/workflow names"), true)
  assert.equal(commandSource.includes("native OpenCode settings panel"), false)
  assert.equal(commandSource.includes("built-in OpenCode preferences page"), false)
  assert.equal(commandSource.includes("primary settings-like UX"), true)
  assert.equal(commandSource.includes("plugin-owned settings workflow"), true)
})

test("OpenCode docs describe the routing settings command as the primary settings-like UX", () => {
  const docsReadme = read("docs/README.md")
  const modelConfig = read("docs/model-configuration.md")
  const installDoc = read(".opencode/INSTALL.md")

  assert.equal(docsReadme.includes("/routing-settings"), true)
  assert.equal(modelConfig.includes("/routing-settings"), true)
  assert.equal(installDoc.includes("/routing-settings"), true)
  assert.equal(docsReadme.includes("settings-like UX"), true)
  assert.equal(modelConfig.includes("settings-like UX"), true)
  assert.equal(docsReadme.includes("plugin-owned workflow"), true)
  assert.equal(docsReadme.includes("built-in OpenCode preferences page"), false)
  assert.equal(installDoc.includes("native OpenCode settings panel"), false)
})

test("inherit example remains canonical and free of legacy routing keys", () => {
  const inheritExample = JSON.parse(read("docs/opencode.example.inherit.json"))

  assert.equal(typeof inheritExample.model, "string")
  assert.equal(inheritExample.agent, undefined)
  assert.equal(inheritExample.agents, undefined)
  assert.equal(typeof inheritExample.note, "string")
  assert.equal(/'agent' section/.test(inheritExample.note), true)
})

test("model configuration intro preserves the four documented methods", () => {
  const docs = read("docs/model-configuration.md")
  const methods = [
    "1. **Agent Frontmatter**",
    "2. **OpenCode Config**",
    "3. **Multiple Providers with Same Models**",
    "4. **Claude Code Configuration**",
  ]

  for (const method of methods) {
    assert.equal(docs.includes(method), true, `missing documented method heading: ${method}`)
  }
})
