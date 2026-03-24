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

  assert.equal(openCodeSection.includes('"mcpServers"'), false)
  assert.equal(openCodeSection.includes('"mcp"'), true)
  assert.equal(readme.includes('"mcpServers"'), false)
})

test("test_opencode_install_docs_describe_installer_first_tm_path", () => {
  const installDoc = read(".opencode/INSTALL.md")

  assert.equal(installDoc.includes("~/.local/bin/tm"), true)
  assert.equal(installDoc.includes("tm sync"), true)
  assert.equal(installDoc.includes("LINEAR_API_KEY"), true)
})

test("test_opencode_manual_fallback_does_not_claim_dot_opencode_is_canonical_config", () => {
  const guide = read("docs/linear-mcp-setup.md")

  assert.equal(guide.includes(".opencode/config.json"), false)
  assert.equal(guide.includes("opencode.json"), true)
})

test("test_opencode_tm_linear_command_exists", () => {
  const commandPath = path.join(repoRoot, ".opencode", "commands", "tm-linear-setup.md")
  assert.equal(fs.existsSync(commandPath), true)

  const command = fs.readFileSync(commandPath, "utf8")
  assert.equal(command.includes("tm sync"), true)
  assert.equal(command.includes("LINEAR_API_KEY"), true)
})
