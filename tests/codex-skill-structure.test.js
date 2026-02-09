const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { syncCodexSkills } = require("../scripts/sync-codex-skills.js")

const mkTmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "codex-structure-"))

const write = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

test("generated codex skills contain required SKILL.md structure", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "brainstorming", "SKILL.md"),
      "---\nname: brainstorming\ndescription: Use for iterative design before implementation.\n---\n\nBrainstorming body\n",
    )
    write(
      path.join(root, "commands", "write-plan.md"),
      "---\nname: write-plan\ndescription: Create implementation plans from approved designs.\n---\n\ncommand body\n",
    )
    write(
      path.join(root, "agents", "review-testing.md"),
      "---\nname: review-testing\ndescription: Review test coverage and test quality.\n---\n\nagent body\n",
    )

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, true)

    const skillsRoot = path.join(root, ".agents", "skills")
    const generatedDirs = fs
      .readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))

    assert.deepEqual(generatedDirs, [
      "codex-agent-review-testing",
      "codex-command-write-plan",
      "codex-skill-brainstorming",
    ])

    for (const dirName of generatedDirs) {
      const skillPath = path.join(skillsRoot, dirName, "SKILL.md")
      assert.equal(fs.existsSync(skillPath), true)
      const content = fs.readFileSync(skillPath, "utf8")
      assert.equal(content.startsWith("---\n"), true)
      assert.equal(content.includes(`\nname: ${dirName}`), true)
      assert.equal(content.includes("\ndescription:"), true)
    }

    const commandWrapper = fs.readFileSync(path.join(skillsRoot, "codex-command-write-plan", "SKILL.md"), "utf8")
    assert.equal(commandWrapper.includes("# Codex Command Wrapper"), true)
    assert.equal(commandWrapper.includes("commands/write-plan.md"), true)
    assert.equal(commandWrapper.includes("```markdown"), true)

    const agentWrapper = fs.readFileSync(path.join(skillsRoot, "codex-agent-review-testing", "SKILL.md"), "utf8")
    assert.equal(agentWrapper.includes("# Codex Agent Wrapper"), true)
    assert.equal(agentWrapper.includes("agents/review-testing.md"), true)

    const skillWrapper = fs.readFileSync(path.join(skillsRoot, "codex-skill-brainstorming", "SKILL.md"), "utf8")
    assert.equal(skillWrapper.includes("Generated from skills/brainstorming/SKILL.md"), true)
    assert.equal(skillWrapper.includes("Brainstorming body"), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
