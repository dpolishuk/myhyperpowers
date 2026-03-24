const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

const extractJsonBlockAfter = (text, marker) => {
  const afterMarker = text.split(marker)[1] || ""
  const match = afterMarker.match(/```json\n([\s\S]*?)\n```/)
  assert.ok(match, `missing JSON block after ${marker}`)
  return JSON.parse(match[1])
}

const extractTextBlock = (text) => {
  const match = text.match(/```text\n([\s\S]*?)\n```/)
  assert.ok(match, "missing text block")
  return match[1]
}

test("test_opencode_docs_use_mcp_not_mcpServers", () => {
  const guide = read("docs/linear-mcp-setup.md")
  const readme = read("README.md")
  const openCodeSection = guide.split("### OpenCode")[1]?.split("## How It All Fits Together")[0] || ""
  const guideConfig = extractJsonBlockAfter(guide, "### OpenCode")
  const readmeConfig = extractJsonBlockAfter(readme, "### Linear MCP Server (Optional)")

  assert.equal(openCodeSection.includes('"mcpServers"'), false)
  assert.deepEqual(Object.keys(guideConfig), ["mcp"])
  assert.equal(guideConfig.mcp.linear.type, "local")
  assert.deepEqual(guideConfig.mcp.linear.command, ["npx", "-y", "@tacticlaunch/mcp-linear@1.0.12"])
  assert.equal(guideConfig.mcp.linear.environment.LINEAR_API_KEY, "{env:LINEAR_API_KEY}")
  assert.equal(openCodeSection.includes("opencode.json"), true)
  assert.deepEqual(Object.keys(readmeConfig), ["mcp"])
  assert.equal(readmeConfig.mcp.linear.type, "local")
  assert.equal(readmeConfig.mcp.linear.environment.LINEAR_API_KEY, "{env:LINEAR_API_KEY}")
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
  assert.equal(guide.includes("from a Hyperpowers checkout"), true)
  assert.equal(guide.includes("~/.local/bin/tm --help"), true)
})

test("test_opencode_tm_linear_command_exists", () => {
  const commandPath = path.join(repoRoot, ".opencode", "commands", "tm-linear-setup.md")
  assert.equal(fs.existsSync(commandPath), true)

  const command = fs.readFileSync(commandPath, "utf8")
  const textBlock = extractTextBlock(command)

  assert.match(textBlock, /1\. From a Hyperpowers checkout, run `\.\/scripts\/install\.sh --opencode`/)
  assert.match(textBlock, /2\. Configure Linear credentials:/)
  assert.match(textBlock, /LINEAR_API_KEY/)
  assert.match(textBlock, /LINEAR_TEAM_KEY/)
  assert.match(textBlock, /3\. Verify the shared tm path:/)
  assert.match(textBlock, /tm sync/)
  assert.match(textBlock, /4\. OpenCode project config belongs in `opencode\.json`/)
  assert.match(textBlock, /Use the `mcp` key for MCP servers/)
})

test("test_opencode_package_readme_marks_npm_path_as_package_only", () => {
  const packageReadme = read("packages/opencode-plugin/README.md")

  assert.equal(packageReadme.includes("./scripts/install.sh --opencode"), true)
  assert.equal(packageReadme.includes("shared `tm` runtime"), true)
  assert.equal(packageReadme.includes("project-root `opencode.json`"), true)
  assert.equal(packageReadme.includes("`.opencode/` for project-local commands"), true)
})

test("test_opencode_provider_examples_use_env_interpolation_contract", () => {
  const docsReadme = read("docs/README.md")

  assert.equal(docsReadme.includes('"apiKey": "${GLM_API_KEY}"'), false)
  assert.equal(docsReadme.includes('"apiKey": "{env:GLM_API_KEY}"'), true)
})
