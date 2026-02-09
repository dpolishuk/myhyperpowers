const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { execFileSync } = require("node:child_process")

const repoRoot = path.resolve(__dirname, "..")
const installerPath = path.join(repoRoot, "scripts", "install-codex-plugin.sh")
const currentVersion = JSON.parse(
  fs.readFileSync(path.join(repoRoot, ".claude-plugin", "plugin.json"), "utf8"),
).version

const runInstaller = (args, env) => {
  return execFileSync("bash", [installerPath, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  })
}

const countBackupDirs = (backupRoot) => {
  if (!fs.existsSync(backupRoot)) {
    return 0
  }
  return fs.readdirSync(backupRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
}

test("global install copies codex wrappers and writes version file", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-installer-home-"))

  try {
    runInstaller(["--global", "--force"], { HOME: tempHome })

    const installedSkill = path.join(tempHome, ".codex", "skills", "codex-skill-brainstorming", "SKILL.md")
    const versionFile = path.join(tempHome, ".codex", ".hyperpowers-codex-version")

    assert.equal(fs.existsSync(installedSkill), true)
    assert.equal(fs.existsSync(versionFile), true)
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})

test("local install supports explicit target directory", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-installer-home-"))
  const tempTarget = fs.mkdtempSync(path.join(os.tmpdir(), "codex-installer-target-"))

  try {
    runInstaller(["--local", "--target", tempTarget, "--force"], { HOME: tempHome })

    const installedSkill = path.join(tempTarget, ".codex", "skills", "codex-command-execute-ralph", "SKILL.md")
    const versionFile = path.join(tempTarget, ".codex", ".hyperpowers-codex-version")

    assert.equal(fs.existsSync(installedSkill), true)
    assert.equal(fs.existsSync(versionFile), true)
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true })
    fs.rmSync(tempTarget, { recursive: true, force: true })
  }
})

test("installer supports --codex-home override", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-installer-home-"))
  const customCodexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-home-"))

  try {
    runInstaller(["--global", "--codex-home", customCodexHome, "--force"], { HOME: tempHome })

    const installedSkill = path.join(customCodexHome, "skills", "codex-skill-brainstorming", "SKILL.md")
    const versionFile = path.join(customCodexHome, ".hyperpowers-codex-version")

    assert.equal(fs.existsSync(installedSkill), true)
    assert.equal(fs.existsSync(versionFile), true)
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true })
    fs.rmSync(customCodexHome, { recursive: true, force: true })
  }
})

test("installer backs up existing codex wrappers before overwrite", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-installer-home-"))
  const preexistingSkill = path.join(tempHome, ".codex", "skills", "codex-skill-brainstorming", "SKILL.md")

  try {
    fs.mkdirSync(path.dirname(preexistingSkill), { recursive: true })
    fs.writeFileSync(preexistingSkill, "legacy-content")

    runInstaller(["--global", "--force"], { HOME: tempHome })

    const backupRoot = path.join(tempHome, ".codex", ".hyperpowers-codex-backup")
    const backups = fs
      .readdirSync(backupRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    assert.equal(backups.length > 0, true)

    const latestBackup = backups.sort().at(-1)
    const backupSkill = path.join(backupRoot, latestBackup, "skills", "codex-skill-brainstorming", "SKILL.md")
    const currentSkill = fs.readFileSync(preexistingSkill, "utf8")

    assert.equal(fs.existsSync(backupSkill), true)
    assert.equal(fs.readFileSync(backupSkill, "utf8"), "legacy-content")
    assert.equal(currentSkill.includes("legacy-content"), false)
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})

test("installer supports --status and --version output", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-installer-home-"))

  try {
    runInstaller(["--global", "--force"], { HOME: tempHome })

    const status = runInstaller(["--global", "--status"], { HOME: tempHome })
    assert.equal(status.includes("Codex Wrapper Install Status"), true)
    assert.equal(status.includes("Installed wrappers:"), true)

    const version = runInstaller(["--global", "--version"], { HOME: tempHome })
    assert.equal(version.includes("Current:"), true)
    assert.equal(version.includes("Installed:"), true)
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})

test("installer is idempotent without --force for same version", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-installer-home-"))

  try {
    runInstaller(["--global", "--force"], { HOME: tempHome })
    const backupRoot = path.join(tempHome, ".codex", ".hyperpowers-codex-backup")
    const beforeBackups = countBackupDirs(backupRoot)

    const rerun = runInstaller(["--global"], { HOME: tempHome })
    const afterBackups = countBackupDirs(backupRoot)

    assert.equal(rerun.includes("already installed"), true)
    assert.equal(afterBackups, beforeBackups)
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})

test("installer does not skip install when version file exists but wrappers are missing", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-installer-home-"))

  try {
    const codexRoot = path.join(tempHome, ".codex")
    const versionFile = path.join(codexRoot, ".hyperpowers-codex-version")
    const installedSkill = path.join(codexRoot, "skills", "codex-skill-brainstorming", "SKILL.md")

    fs.mkdirSync(codexRoot, { recursive: true })
    fs.writeFileSync(versionFile, `${currentVersion}\n`)

    const output = runInstaller(["--global"], { HOME: tempHome })

    assert.equal(output.includes("already installed"), false)
    assert.equal(fs.existsSync(installedSkill), true)
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})

test("installer retains only three newest backups", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-installer-home-"))
  const preexistingSkill = path.join(tempHome, ".codex", "skills", "codex-skill-brainstorming", "SKILL.md")
  const backupRoot = path.join(tempHome, ".codex", ".hyperpowers-codex-backup")

  try {
    fs.mkdirSync(backupRoot, { recursive: true })
    for (let attempt = 0; attempt < 5; attempt += 1) {
      fs.mkdirSync(path.join(backupRoot, `backup-2026010${attempt}-000000`), { recursive: true })
    }

    fs.mkdirSync(path.dirname(preexistingSkill), { recursive: true })
    fs.writeFileSync(preexistingSkill, "legacy-content")
    runInstaller(["--global", "--force"], { HOME: tempHome })

    const backups = fs
      .readdirSync(backupRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    assert.equal(backups.length <= 3, true)
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})
