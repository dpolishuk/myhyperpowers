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

test("dedicated OpenCode agent-routing example exists with global defaults", () => {
  const examplePath = path.join(repoRoot, "docs", "opencode.example.agent-routing.json")
  assert.equal(fs.existsSync(examplePath), true)

  const example = JSON.parse(fs.readFileSync(examplePath, "utf8"))
  assert.ok(example.agent)
  assert.equal(example.agents, undefined)
  assert.equal(example.hyperpowers, undefined, "hyperpowers key must not appear in opencode.json examples")
  assert.equal(typeof example.agent.ralph.model, "string")
  assert.equal(typeof example.agent["test-runner"].model, "string")
  assert.equal(typeof example.agent["code-reviewer"].model, "string")
  assert.equal(typeof example.agent["review-testing"].model, "string")
  assert.equal(typeof example.agent["review-documentation"].model, "string")
  assert.equal(typeof example.agent["autonomous-reviewer"].model, "string")
})

test("separate hyperpowers routing example exists with workflow overrides", () => {
  const hpExamplePath = path.join(repoRoot, "docs", "opencode.example.hyperpowers-routing.json")
  assert.equal(fs.existsSync(hpExamplePath), true)

  const hpExample = JSON.parse(fs.readFileSync(hpExamplePath, "utf8"))
  assert.ok(hpExample.workflowOverrides)
  assert.equal(hpExample.comment.includes("active for Hyperpowers task-tool dispatch paths"), true)
  assert.equal(typeof hpExample.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model, "string")
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
    docsReadme.includes("1. `.opencode/hyperpowers-routing.json` → `workflowOverrides.<workflow>.<name>.model` (highest)"),
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
  assert.equal(docsReadme.includes("same underlying routing map") || docsReadme.includes("same routing map"), true)
  assert.equal(docsReadme.includes("active `workflowOverrides` shape"), true)
  assert.equal(docsReadme.includes("hyperpowers_agent_routing_config"), true)
  assert.equal(docsReadme.includes("/models"), true)
  assert.equal(modelConfig.includes("/models"), true)
})

test("OpenCode plugin source registers the routing config tool and writes opencode.json", () => {
  const pluginPath = path.join(repoRoot, ".opencode", "plugins", "agent-routing-config.ts")
  const corePath = path.join(repoRoot, ".opencode", "plugins", "routing-wizard-core.ts")
  assert.equal(fs.existsSync(pluginPath), true)
  assert.equal(fs.existsSync(corePath), true)

  const pluginSource = fs.readFileSync(pluginPath, "utf8")
  const coreSource = fs.readFileSync(corePath, "utf8")
  assert.equal(/hyperpowers_agent_routing_config/.test(pluginSource), true)
  assert.equal(/enum\(\["get",\s*"set",\s*"set-group",\s*"apply-preset",\s*"bootstrap"\]\)/.test(pluginSource), true)
  assert.equal(/executeRoutingAction/.test(pluginSource), true)
  assert.equal(/action\s*===\s*"get"/.test(coreSource), true)
  assert.equal(/opencode\.json/.test(coreSource), true)
})

test("OpenCode routing settings command exists and delegates to the routing config tool", () => {
  const commandPath = path.join(repoRoot, ".opencode", "commands", "routing-settings.md")
  assert.equal(fs.existsSync(commandPath), true)

  const commandSource = fs.readFileSync(commandPath, "utf8")
  assert.equal(commandSource.includes("hyperpowers_agent_routing_config"), true)
  assert.equal(commandSource.includes("action=get"), true)
  assert.equal(commandSource.includes("action=set"), true)
  assert.equal(commandSource.includes("action=set-group"), true)
  assert.equal(commandSource.includes("action=apply-preset"), true)
  assert.equal(commandSource.includes("action=bootstrap"), true)
  assert.equal(commandSource.includes("Never edit `opencode.json` directly"), true)
  assert.equal(commandSource.includes("no update was made"), true)
  assert.equal(
    commandSource.includes("unsupported agent/workflow/group/preset/model names") ||
      commandSource.includes("unsupported agent/workflow/group/preset names"),
    true,
  )
  assert.equal(commandSource.includes("native OpenCode settings panel"), false)
  assert.equal(commandSource.includes("built-in OpenCode preferences page"), false)
  assert.equal(commandSource.includes("primary settings-like UX"), true)
  assert.equal(commandSource.includes("plugin-owned settings workflow"), true)
  assert.equal(commandSource.includes("availableModels"), true)
  assert.equal(commandSource.includes("if no routing config exists") || commandSource.includes("first-run"), true)
  assert.equal(commandSource.includes("workflow overrides") || commandSource.includes("workflowOverrides"), true)
  assert.equal(commandSource.includes("warning") || commandSource.includes("malformed"), true)
  assert.equal(commandSource.includes("cost-optimized"), true)
  assert.equal(commandSource.includes("quality-first"), true)
})

test("OpenCode CLI routing wizard script exists and uses the canonical split-file contract", () => {
  const scriptPath = path.join(repoRoot, "scripts", "opencode-routing-wizard.ts")
  assert.equal(fs.existsSync(scriptPath), true)

  const scriptSource = fs.readFileSync(scriptPath, "utf8")
  assert.equal(scriptSource.includes("opencode models"), true)
  assert.equal(scriptSource.includes("opencode.json"), true)
  assert.equal(scriptSource.includes(".opencode/hyperpowers-routing.json"), true)
  assert.equal(scriptSource.includes("routing-wizard-core"), true)
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
