const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { syncCodexSkills } = require("../scripts/sync-codex-skills.js")

const mkTmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "codex-collision-"))

const write = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

test("syncCodexSkills fails fast on slug collisions", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "one", "SKILL.md"),
      "---\nname: Foo Bar\ndescription: First colliding skill description.\n---\n\nbody\n",
    )
    write(
      path.join(root, "skills", "two", "SKILL.md"),
      "---\nname: foo-bar\ndescription: Second colliding skill description.\n---\n\nbody\n",
    )

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, false)
    assert.equal(result.errors.some((x) => x.includes("slug collision")), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
