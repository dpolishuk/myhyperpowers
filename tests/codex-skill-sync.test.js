const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { syncCodexSkills } = require("../scripts/sync-codex-skills.js")

const mkTmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "codex-sync-"))

const write = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

const baseSkill = (name, description, body = "# Title\n") =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`

const baseDoc = (name, description) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`

test("syncCodexSkills writes deterministic output and --check detects drift", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "alpha", "SKILL.md"),
      baseSkill("alpha", "Use alpha for deterministic checks.", "alpha body\n"),
    )
    write(
      path.join(root, "skills", "beta", "SKILL.md"),
      baseSkill("beta", "Use beta for deterministic checks.", "beta body\n"),
    )
    write(path.join(root, "commands", "execute-ralph.md"), baseDoc("execute-ralph", "Run autonomous execution command."))
    write(path.join(root, "agents", "review-quality.md"), baseDoc("review-quality", "Review quality and bug risks."))

    const first = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(first.ok, true)
    assert.equal(first.updatedCount > 0, true)

    const second = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(second.ok, true)
    assert.equal(second.updatedCount, 0)

    const checkPass = syncCodexSkills({ projectRoot: root, mode: "check" })
    assert.equal(checkPass.ok, true)

    const staleFile = path.join(root, ".agents", "skills", "codex-skill-alpha", "SKILL.md")
    fs.writeFileSync(staleFile, "stale")

    const checkFail = syncCodexSkills({ projectRoot: root, mode: "check" })
    assert.equal(checkFail.ok, false)
    assert.equal(checkFail.errors.some((x) => x.includes("stale generated content")), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
