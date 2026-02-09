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
      "---\nname: alpha\ndescription: Has YAML-risk chars: [x] # comment {obj} \"quote\" \\slash\n---\n\nbody\n",
    )

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, true)

    const generated = fs.readFileSync(path.join(root, ".agents", "skills", "codex-skill-alpha", "SKILL.md"), "utf8")
    assert.equal(
      generated.includes(
        'description: "Use when the original skill \'alpha\' applies. Has YAML-risk chars: [x] # comment {obj} \\\"quote\\\" \\\\slash"',
      ),
      true,
    )
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

test("syncCodexSkills supports .agents/skills symlinked to .kimi/skills inside project", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha skill for symlink topology test.\n---\n\nbody\n",
    )

    fs.mkdirSync(path.join(root, ".agents"), { recursive: true })
    fs.mkdirSync(path.join(root, ".kimi"), { recursive: true })
    fs.mkdirSync(path.join(root, ".kimi", "skills"), { recursive: true })
    fs.symlinkSync(path.join(root, ".kimi", "skills"), path.join(root, ".agents", "skills"), "dir")

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, true)

    const throughAgents = path.join(root, ".agents", "skills", "codex-skill-alpha", "SKILL.md")
    const throughKimi = path.join(root, ".kimi", "skills", "codex-skill-alpha", "SKILL.md")
    assert.equal(fs.existsSync(throughAgents), true)
    assert.equal(fs.existsSync(throughKimi), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("syncCodexSkills blocks unsafe read paths for generated SKILL.md symlinks", () => {
  const root = mkTmpRoot()
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "codex-outside-read-"))

  try {
    write(
      path.join(root, "skills", "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha skill for unsafe read guard test.\n---\n\nbody\n",
    )

    const firstWrite = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(firstWrite.ok, true)

    const externalFile = path.join(outside, "external-skill.md")
    fs.writeFileSync(externalFile, "external")

    const generatedFile = path.join(root, ".agents", "skills", "codex-skill-alpha", "SKILL.md")
    fs.rmSync(generatedFile, { force: true })
    fs.symlinkSync(externalFile, generatedFile)

    const check = syncCodexSkills({ projectRoot: root, mode: "check" })
    assert.equal(check.ok, false)
    assert.equal(check.errors.some((message) => message.includes("unsafe read path resolves outside project root")), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  }
})

test("syncCodexSkills blocks unsafe remove path for orphan codex symlinks", () => {
  const root = mkTmpRoot()
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "codex-outside-remove-"))

  try {
    write(
      path.join(root, "skills", "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha skill for unsafe remove guard test.\n---\n\nbody\n",
    )

    const firstWrite = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(firstWrite.ok, true)

    const orphanLink = path.join(root, ".agents", "skills", "codex-orphan")
    fs.symlinkSync(outside, orphanLink, "dir")

    const rewrite = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(rewrite.ok, false)
    assert.equal(rewrite.errors.some((message) => message.includes("unsafe remove path resolves outside project root")), true)
    assert.equal(fs.existsSync(outside), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  }
})

test("syncCodexSkills blocks unsafe write path when expected slug dir is symlinked outside", () => {
  const root = mkTmpRoot()
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "codex-outside-write-"))

  try {
    write(
      path.join(root, "skills", "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha skill for unsafe write guard test.\n---\n\nbody\n",
    )

    const outputRoot = path.join(root, ".agents", "skills")
    fs.mkdirSync(outputRoot, { recursive: true })
    fs.symlinkSync(outside, path.join(outputRoot, "codex-skill-alpha"), "dir")

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, false)
    assert.equal(result.errors.some((message) => message.includes("unsafe write path resolves outside project root")), true)
    assert.equal(fs.existsSync(path.join(outside, "SKILL.md")), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  }
})
