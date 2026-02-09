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

test("syncCodexSkills writes deterministic output and enforces check/write semantics", () => {
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
    assert.equal(first.expectedCount, 4)
    assert.equal(first.updatedCount, 4)

    const second = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(second.ok, true)
    assert.equal(second.expectedCount, 4)
    assert.equal(second.updatedCount, 0)

    const checkPass = syncCodexSkills({ projectRoot: root, mode: "check" })
    assert.equal(checkPass.ok, true)
    assert.equal(checkPass.expectedCount, 4)

    const staleFile = path.join(root, ".agents", "skills", "codex-skill-alpha", "SKILL.md")
    fs.writeFileSync(staleFile, "stale")

    const checkFail = syncCodexSkills({ projectRoot: root, mode: "check" })
    assert.equal(checkFail.ok, false)
    assert.equal(checkFail.errors.some((x) => x.includes("stale generated content")), true)
    assert.equal(fs.readFileSync(staleFile, "utf8"), "stale")

    const repair = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(repair.ok, true)
    assert.equal(repair.updatedCount, 1)
    assert.equal(fs.readFileSync(staleFile, "utf8").includes("name: codex-skill-alpha"), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("syncCodexSkills detects and removes orphan codex directories", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "alpha", "SKILL.md"),
      baseSkill("alpha", "Use alpha for deterministic checks.", "alpha body\n"),
    )

    const first = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(first.ok, true)
    assert.equal(first.expectedCount, 1)
    assert.equal(first.updatedCount, 1)

    const orphanDir = path.join(root, ".agents", "skills", "codex-orphan")
    write(path.join(orphanDir, "SKILL.md"), "orphan")

    const checkFail = syncCodexSkills({ projectRoot: root, mode: "check" })
    assert.equal(checkFail.ok, false)
    assert.equal(checkFail.errors.some((x) => x.includes("orphan generated directory")), true)
    assert.equal(fs.existsSync(orphanDir), true)

    const cleanup = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(cleanup.ok, true)
    assert.equal(cleanup.updatedCount, 1)
    assert.equal(fs.existsSync(orphanDir), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("syncCodexSkills can target alternate output roots", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "alpha", "SKILL.md"),
      baseSkill("alpha", "Use alpha for deterministic checks.", "alpha body\n"),
    )

    const result = syncCodexSkills({
      projectRoot: root,
      mode: "write",
      outputRootRelative: ".kimi/skills",
    })
    assert.equal(result.ok, true)
    const generatedFile = path.join(root, ".kimi", "skills", "codex-skill-alpha", "SKILL.md")
    assert.equal(fs.existsSync(generatedFile), true)

    fs.writeFileSync(generatedFile, "stale")
    const checkFail = syncCodexSkills({
      projectRoot: root,
      mode: "check",
      outputRootRelative: ".kimi/skills",
    })
    assert.equal(checkFail.ok, false)
    assert.equal(checkFail.errors.some((x) => x.includes(".kimi/skills/codex-skill-alpha/SKILL.md")), true)
    assert.equal(checkFail.errors.some((x) => x.includes(".agents/skills")), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
