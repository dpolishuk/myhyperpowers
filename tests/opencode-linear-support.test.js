const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

test("test_opencode_docs_use_mcp_not_mcpServers", () => {
  const guide = read("docs/linear-mcp-setup.md")
  const readme = read("README.md")
  const openCodeSection = guide.split("### OpenCode")[1]?.split("## How It All Fits Together")[0] || ""
  const readmeLinearSection = readme.split("### Linear MCP Server (Optional)")[1]?.split("## Uninstall")[0] || ""

  assert.equal(openCodeSection.includes('"mcpServers"'), false)
  assert.equal(openCodeSection.includes('"mcp"'), true)
  assert.equal(openCodeSection.includes("opencode.json"), true)
  assert.equal(readmeLinearSection.includes('"mcpServers"'), false)
  assert.equal(readmeLinearSection.includes('"mcp"'), true)
  assert.equal(readmeLinearSection.includes("opencode.json"), true)
})

test("test_opencode_install_docs_describe_installer_first_tm_path", () => {
  const installDoc = read(".opencode/INSTALL.md")

  assert.equal(installDoc.includes("./scripts/install.sh --opencode"), true)
  assert.equal(installDoc.includes("~/.local/bin/tm"), true)
  assert.equal(installDoc.includes("tm sync"), true)
  assert.equal(installDoc.includes("LINEAR_API_KEY"), true)
  assert.equal(installDoc.includes("LINEAR_TEAM_KEY"), true)
  assert.equal(installDoc.includes("Manual plugin setup alone does **not** provision the shared tm runtime"), true)
  assert.equal(installDoc.includes("cd ~/.config/opencode/hyperpowers/.opencode"), true)
})

test("test_opencode_manual_fallback_does_not_claim_dot_opencode_is_canonical_config", () => {
  const guide = read("docs/linear-mcp-setup.md")
  const installDoc = read(".opencode/INSTALL.md")

  assert.equal(guide.includes(".opencode/config.json"), false)
  assert.equal(guide.includes("opencode.json"), true)
  assert.equal(installDoc.includes("opencode.json"), true)
})

test("test_opencode_linear_guide_mentions_installer_prerequisite", () => {
  const guide = read("docs/linear-mcp-setup.md")

  assert.equal(guide.includes("./scripts/install.sh --opencode"), true)
  assert.equal(guide.includes("~/.local/bin/tm --help"), true)
})

test("test_opencode_tm_linear_command_exists", () => {
  const commandPath = path.join(repoRoot, ".opencode", "commands", "tm-linear-setup.md")
  assert.equal(fs.existsSync(commandPath), true)

  const command = fs.readFileSync(commandPath, "utf8")
  assert.equal(command.includes("From a Hyperpowers checkout"), true)
  assert.equal(command.includes("tm sync"), true)
  assert.equal(command.includes("LINEAR_API_KEY"), true)
  assert.equal(command.includes("LINEAR_TEAM_KEY"), true)
  assert.equal(command.includes("opencode.json"), true)
  assert.equal(command.includes("mcp"), true)
})
