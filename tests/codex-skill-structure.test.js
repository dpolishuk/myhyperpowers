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

    assert.equal(generatedDirs.includes("codex-skill-brainstorming"), true)
    assert.equal(generatedDirs.includes("codex-command-write-plan"), true)
    assert.equal(generatedDirs.includes("codex-agent-review-testing"), true)

    for (const dirName of generatedDirs) {
      const skillPath = path.join(skillsRoot, dirName, "SKILL.md")
      assert.equal(fs.existsSync(skillPath), true)
      const content = fs.readFileSync(skillPath, "utf8")
      assert.equal(content.startsWith("---\n"), true)
      assert.equal(content.includes("\nname:"), true)
      assert.equal(content.includes("\ndescription:"), true)
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
