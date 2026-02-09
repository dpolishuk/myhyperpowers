const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { syncCodexSkills } = require("../scripts/sync-codex-skills.js")

const mkTmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "codex-hardening-"))

const write = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

test("syncCodexSkills blocks symlinked output roots resolving outside project", () => {
  const root = mkTmpRoot()
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "codex-outside-"))

  try {
    write(
      path.join(root, "skills", "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha skill for symlink safety test.\n---\n\nbody\n",
    )

    fs.symlinkSync(outside, path.join(root, ".agents"), "dir")

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, false)
    assert.equal(result.errors.some((message) => message.includes("resolves outside project root")), true)

    const outsideGenerated = path.join(outside, "skills", "codex-skill-alpha", "SKILL.md")
    assert.equal(fs.existsSync(outsideGenerated), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  }
})

test("syncCodexSkills emits YAML-safe quoted descriptions in generated frontmatter", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: Has YAML-risk chars: [x] # comment {obj}\n---\n\nbody\n",
    )

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, true)

    const generated = fs.readFileSync(path.join(root, ".agents", "skills", "codex-skill-alpha", "SKILL.md"), "utf8")
    assert.equal(generated.includes('description: "Use when the original skill \'alpha\' applies. Has YAML-risk chars: [x] # comment {obj}"'), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("syncCodexSkills check mode fails when generated outputs are missing", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha skill for missing-output check test.\n---\n\nbody\n",
    )

    const checkResult = syncCodexSkills({ projectRoot: root, mode: "check" })
    assert.equal(checkResult.ok, false)
    assert.equal(checkResult.errors.some((message) => message.includes("missing generated skill file")), true)
    assert.equal(fs.existsSync(path.join(root, ".agents", "skills")), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
