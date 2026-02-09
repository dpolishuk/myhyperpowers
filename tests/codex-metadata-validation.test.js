const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { parseCli, syncCodexSkills } = require("../scripts/sync-codex-skills.js")

const mkTmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "codex-meta-"))

const write = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

test("syncCodexSkills fails on missing frontmatter in canonical skill", () => {
  const root = mkTmpRoot()

  try {
    write(path.join(root, "skills", "broken", "SKILL.md"), "no frontmatter")
    const result = syncCodexSkills({ projectRoot: root, mode: "write" })

    assert.equal(result.ok, false)
    assert.equal(result.errors.some((message) => message.includes("missing frontmatter")), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("parseCli accepts explicit output root and mode", () => {
  const parsed = parseCli(["--output-root", ".kimi/skills", "--check"])
  assert.equal(parsed.outputRootRelative, ".kimi/skills")
  assert.equal(parsed.mode, "check")
})

test("parseCli fails when output root value is missing", () => {
  assert.throws(() => parseCli(["--output-root"]), /--output-root requires a value/)
  assert.throws(() => parseCli(["--output-root", "--check"]), /--output-root requires a value/)
  assert.throws(() => parseCli(["--project-root", "--check"]), /--project-root requires a value/)
  assert.throws(() => parseCli(["--output-root", "   "]), /--output-root requires a value/)
})

test("syncCodexSkills rejects output roots outside project", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "ok", "SKILL.md"),
      "---\nname: ok\ndescription: Good skill metadata.\n---\n\nbody\n",
    )

    const absolute = syncCodexSkills({
      projectRoot: root,
      mode: "write",
      outputRootRelative: path.join(root, "outside"),
    })
    assert.equal(absolute.ok, false)
    assert.equal(absolute.errors.some((message) => message.includes("project-relative")), true)

    const escaped = syncCodexSkills({
      projectRoot: root,
      mode: "write",
      outputRootRelative: "../outside",
    })
    assert.equal(escaped.ok, false)
    assert.equal(escaped.errors.some((message) => message.includes("escapes project root")), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("syncCodexSkills fails on missing description in canonical agent", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "ok", "SKILL.md"),
      "---\nname: ok\ndescription: Good skill metadata.\n---\n\nbody\n",
    )
    write(path.join(root, "agents", "bad.md"), "---\nname: bad\n---\n\nbody\n")

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, false)
    assert.equal(result.errors.some((message) => message.includes("missing frontmatter.description")), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("syncCodexSkills falls back to command filename when command name is absent", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "ok", "SKILL.md"),
      "---\nname: ok\ndescription: Good skill metadata.\n---\n\nbody\n",
    )
    write(
      path.join(root, "commands", "analyze-tests.md"),
      "---\ndescription: Analyze tests command without explicit name.\n---\n\nbody\n",
    )

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, true)

    const generated = path.join(root, ".agents", "skills", "codex-command-analyze-tests", "SKILL.md")
    assert.equal(fs.existsSync(generated), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("syncCodexSkills fails on invalid canonical skill names", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "invalid", "SKILL.md"),
      "---\nname: !!!\ndescription: Invalid slug target.\n---\n\nbody\n",
    )

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, false)
    assert.equal(result.errors.some((message) => message.includes("invalid canonical skill name")), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("syncCodexSkills writes slug-safe wrapper frontmatter names", () => {
  const root = mkTmpRoot()

  try {
    write(
      path.join(root, "skills", "one", "SKILL.md"),
      "---\nname: Foo Bar\ndescription: Skill with spaces in canonical name.\n---\n\nbody\n",
    )
    write(
      path.join(root, "commands", "run-plan.md"),
      "---\nname: Run Plan\ndescription: Command with spaces in canonical name.\n---\n\nbody\n",
    )
    write(
      path.join(root, "agents", "review-quality-plus.md"),
      "---\nname: Review Quality Plus\ndescription: Agent with spaces in canonical name.\n---\n\nbody\n",
    )

    const result = syncCodexSkills({ projectRoot: root, mode: "write" })
    assert.equal(result.ok, true)

    const expected = {
      skill: path.join(root, ".agents", "skills", "codex-skill-foo-bar", "SKILL.md"),
      command: path.join(root, ".agents", "skills", "codex-command-run-plan", "SKILL.md"),
      agent: path.join(root, ".agents", "skills", "codex-agent-review-quality-plus", "SKILL.md"),
    }

    assert.equal(fs.existsSync(expected.skill), true)
    assert.equal(fs.existsSync(expected.command), true)
    assert.equal(fs.existsSync(expected.agent), true)

    assert.equal(fs.readFileSync(expected.skill, "utf8").includes("name: codex-skill-foo-bar"), true)
    assert.equal(fs.readFileSync(expected.command, "utf8").includes("name: codex-command-run-plan"), true)
    assert.equal(fs.readFileSync(expected.agent, "utf8").includes("name: codex-agent-review-quality-plus"), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
