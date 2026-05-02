const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const fs = require("node:fs")
const os = require("node:os")
const { spawnSync } = require("node:child_process")

const repoRoot = path.resolve(__dirname, "..")

function makeConflictFixture(home) {
  const conflicts = [
    path.join(home, ".claude", "plugins", "hyperpowers@hyperpowers"),
    path.join(home, ".claude", "plugins", "myhyperpowers@myhyperpowers"),
    path.join(home, ".config", "opencode", "plugins", "superpowers"),
    path.join(home, ".pi", "agent", "extensions", "hyperpowers"),
  ]

  for (const conflict of conflicts) {
    fs.mkdirSync(conflict, { recursive: true })
    fs.writeFileSync(path.join(conflict, "marker.txt"), "legacy conflict\n", "utf8")
  }

  return conflicts
}

function combinedOutput(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`
}

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    ...options,
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result
}

function installEnv(home, extra = {}) {
  return {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, ".config"),
    NO_COLOR: "1",
    ...extra,
  }
}

function makeBootstrapRepo(installShContent = fs.readFileSync(path.join(repoRoot, "scripts", "install.sh"), "utf8")) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-bootstrap-source-"))
  fs.mkdirSync(path.join(repo, "scripts"), { recursive: true })
  fs.mkdirSync(path.join(repo, ".claude-plugin"), { recursive: true })
  fs.writeFileSync(path.join(repo, "scripts", "install.sh"), installShContent, "utf8")
  fs.writeFileSync(path.join(repo, "scripts", "install.ts"), "#!/usr/bin/env bun\n", "utf8")
  fs.writeFileSync(path.join(repo, ".claude-plugin", "plugin.json"), JSON.stringify({ version: "99.0.0" }) + "\n", "utf8")
  runGit(["init"], { cwd: repo })
  runGit(["config", "user.email", "test@example.invalid"], { cwd: repo })
  runGit(["config", "user.name", "Install Test"], { cwd: repo })
  runGit(["add", "."], { cwd: repo })
  runGit(["commit", "-m", "fixture"], { cwd: repo })
  const ref = runGit(["rev-parse", "HEAD"], { cwd: repo }).stdout.trim()
  return { repo, ref }
}

test("install.sh bootstraps from stdin using an offline repository override", { timeout: 60000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-bootstrap-home-"))
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-bootstrap-cwd-"))
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-bootstrap-tmp-"))
  const { repo, ref } = makeBootstrapRepo()
  const script = fs.readFileSync(path.join(repoRoot, "scripts", "install.sh"), "utf8")

  const result = spawnSync("bash", ["-s", "--", "--help"], {
    cwd,
    input: script,
    encoding: "utf8",
    env: installEnv(home, {
      TMPDIR: tmpRoot,
      XPOWERS_REPO_URL: repo,
      XPOWERS_REF: ref,
    }),
    timeout: 60000,
  })

  const output = combinedOutput(result)
  assert.equal(result.status, 0, output)
  assert.match(output, /Unified installer for XPowers/)
  assert.match(output, /--hosts <list>/)
  assert.deepEqual(fs.readdirSync(tmpRoot).filter((name) => name.startsWith("xpowers-install.")), [])
})

test("install.sh bootstrap preserves delegated arguments and exit code", { timeout: 60000 }, () => {
  const delegatedScript = [
    "#!/usr/bin/env bash",
    "printf 'delegated argc=%s\\n' \"$#\"",
    "printf 'delegated args=%s\\n' \"$*\"",
    "exit 37",
    "",
  ].join("\n")
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-bootstrap-exit-home-"))
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-bootstrap-exit-cwd-"))
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-bootstrap-exit-tmp-"))
  const { repo, ref } = makeBootstrapRepo(delegatedScript)
  const script = fs.readFileSync(path.join(repoRoot, "scripts", "install.sh"), "utf8")

  const result = spawnSync("bash", ["-s", "--", "--hosts", "claude,pi", "--dry-run", "--yes"], {
    cwd,
    input: script,
    encoding: "utf8",
    env: installEnv(home, {
      TMPDIR: tmpRoot,
      XPOWERS_REPO_URL: repo,
      XPOWERS_REF: ref,
    }),
    timeout: 60000,
  })

  const output = combinedOutput(result)
  assert.equal(result.status, 37, output)
  assert.match(output, /delegated argc=4/)
  assert.match(output, /delegated args=--hosts claude,pi --dry-run --yes/)
  assert.deepEqual(fs.readdirSync(tmpRoot).filter((name) => name.startsWith("xpowers-install.")), [])
})

test("install.sh --hosts pi delegates through the Bun installer entrypoint", { timeout: 60000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-pi-delegate-home-"))
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-pi-delegate-bin-"))
  const argsFile = path.join(home, "bun-args.txt")
  const bunShim = path.join(binDir, "bun")
  fs.writeFileSync(
    bunShim,
    [
      "#!/usr/bin/env bash",
      "printf '%s\\n' \"$@\" > \"$BUN_ARGS_FILE\"",
      "exit 23",
      "",
    ].join("\n"),
    "utf8",
  )
  fs.chmodSync(bunShim, 0o755)

  const result = spawnSync("bash", ["scripts/install.sh", "--hosts", "pi", "--yes", "--uninstall", "--allow-conflicts"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home, {
      BUN_ARGS_FILE: argsFile,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
    }),
    timeout: 60000,
  })

  const output = combinedOutput(result)
  assert.equal(result.status, 23, output)
  assert.deepEqual(fs.readFileSync(argsFile, "utf8").trim().split("\n"), [
    "scripts/install.ts",
    "--hosts",
    "pi",
    "--yes",
    "--uninstall",
    "--allow-conflicts",
  ])
  assert.doesNotMatch(output, /setup-pi\.sh/)
})

test("bun installer fails fast on legacy package conflicts unless explicitly overridden", { timeout: 120000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-ts-conflict-test-"))
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  const conflicts = makeConflictFixture(home)

  const blocked = spawnSync("bun", ["scripts/install.ts", "--yes", "--hosts", "claude"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 120000,
  })

  const blockedOutput = combinedOutput(blocked)
  assert.notEqual(blocked.status, 0)
  assert.match(blockedOutput, /conflicting install/i)
  assert.match(blockedOutput, /hyperpowers/i)
  assert.match(blockedOutput, new RegExp(conflicts[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(blockedOutput, /--allow-conflicts/)

  const allowed = spawnSync("bun", ["scripts/install.ts", "--yes", "--hosts", "claude", "--features", "not-a-real-feature", "--allow-conflicts"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 120000,
  })

  const allowedOutput = combinedOutput(allowed)
  assert.equal(allowed.status, 0, allowedOutput)
  assert.doesNotMatch(allowedOutput, /conflicting install/i)
})

test("install.sh fails fast on legacy package conflicts in non-interactive mode", { timeout: 120000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-conflict-test-"))
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  const conflicts = makeConflictFixture(home)

  const result = spawnSync("bash", ["scripts/install.sh", "--claude", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 120000,
  })

  const output = combinedOutput(result)
  assert.notEqual(result.status, 0)
  assert.match(output, /conflicting install/i)
  assert.match(output, /hyperpowers/i)
  assert.match(output, new RegExp(conflicts[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(output, /--allow-conflicts/)

  const allowed = spawnSync("bash", ["scripts/install.sh", "--claude", "--yes", "--allow-conflicts"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 120000,
  })

  const allowedOutput = combinedOutput(allowed)
  assert.equal(allowed.status, 0, allowedOutput)
  assert.doesNotMatch(allowedOutput, /conflicting install/i)
})

test("bun installer conflict guard stays before host selection and keeps --hosts interactive", () => {
  const source = fs.readFileSync(path.join(repoRoot, "scripts", "install.ts"), "utf8")
  const conflictGuardIndex = source.indexOf("const conflicts = detectConflictingInstalls()")
  const phase2Index = source.indexOf("// Phase 2: Select hosts")
  assert.ok(conflictGuardIndex > -1, "conflict guard should exist")
  assert.ok(phase2Index > -1, "Phase 2 host selection should exist")
  assert.ok(conflictGuardIndex < phase2Index, "conflict guard should run before host selection UI")

  const nonInteractiveLine = source.match(/const nonInteractive = (?<expr>[^\n]+)/)?.groups?.expr || ""
  assert.ok(nonInteractiveLine.length > 0, "nonInteractive expression should be present in install.ts")
  assert.doesNotMatch(nonInteractiveLine, /args\.hosts/, "--hosts alone must not suppress the conflict prompt")
})

test("bun installer json mode reports structured conflict failures", { timeout: 120000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-ts-json-conflict-test-"))
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  const conflicts = makeConflictFixture(home)

  const result = spawnSync("bun", ["scripts/install.ts", "--json", "--hosts", "claude"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 120000,
  })

  assert.notEqual(result.status, 0)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.ok, false)
  assert.match(payload.error, /conflicting install/i)
  assert.match(payload.error, new RegExp(conflicts[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(payload.error, /--allow-conflicts/)
})

test("setup-pi.sh fails fast on legacy package conflicts before download", { timeout: 60000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "setup-pi-conflict-test-"))
  const binDir = path.join(home, "bin")
  fs.mkdirSync(binDir, { recursive: true })
  for (const cmd of ["pi", "git", "bun"]) {
    const cmdPath = path.join(binDir, cmd)
    fs.writeFileSync(cmdPath, "#!/usr/bin/env bash\nexit 0\n", "utf8")
    fs.chmodSync(cmdPath, 0o755)
  }
  const conflicts = makeConflictFixture(home)

  const result = spawnSync("bash", ["scripts/setup-pi.sh"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home, { PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}` }),
    timeout: 60000,
  })

  const output = combinedOutput(result)
  assert.notEqual(result.status, 0)
  assert.match(output, /conflicting install/i)
  assert.match(output, /hyperpowers/i)
  assert.match(output, new RegExp(conflicts[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(output, /--allow-conflicts/)
})

test("README documents safe curl installer and conflict override", () => {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8")

  assert.match(readme, /curl -fsSL https:\/\/raw\.githubusercontent\.com\/dpolishuk\/xpowers\/main\/scripts\/setup-pi\.sh \| bash/)
  assert.match(readme, /--allow-conflicts/)
  assert.match(readme, /hyperpowers/i)
  assert.match(readme, /myhyperpowers/i)
  assert.match(readme, /superpowers/i)
})

test("install.sh full uninstall preserves unrelated ~/.local/bin/node_modules directory", { timeout: 120000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-test-"))
  const codexHome = path.join(home, ".codex")
  const binDir = path.join(home, ".local", "bin")
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "opencode"), { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "agents"), { recursive: true })

  fs.mkdirSync(codexHome, { recursive: true })
  fs.writeFileSync(path.join(codexHome, ".xpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(codexHome, ".xpowers-version"), "test\n", "utf8")
  fs.mkdirSync(path.join(binDir, "node_modules"), { recursive: true })

  fs.writeFileSync(path.join(home, ".claude", ".xpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(home, ".claude", ".xpowers-version"), "test\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "opencode", ".xpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "opencode", ".xpowers-version"), "test\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "agents", ".xpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "agents", ".xpowers-version"), "test\n", "utf8")

  const result = spawnSync("bash", ["scripts/install.sh", "--uninstall", "--all", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 20000,
  })

  assert.equal(result.status, 0)
  assert.equal(fs.existsSync(path.join(binDir, "node_modules")), true)
})

test("install.sh full uninstall removes managed ~/.local/bin/node_modules symlink", { timeout: 120000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-test-"))
  const codexHome = path.join(home, ".codex")
  const binDir = path.join(home, ".local", "bin")
  const libNodeModules = path.join(home, ".local", "lib", "tm", "node_modules")

  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "opencode"), { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "agents"), { recursive: true })
  fs.mkdirSync(codexHome, { recursive: true })
  fs.writeFileSync(path.join(codexHome, ".xpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(codexHome, ".xpowers-version"), "test\n", "utf8")
  fs.writeFileSync(path.join(home, ".claude", ".xpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(home, ".claude", ".xpowers-version"), "test\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "opencode", ".xpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "opencode", ".xpowers-version"), "test\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "agents", ".xpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "agents", ".xpowers-version"), "test\n", "utf8")
  fs.mkdirSync(binDir, { recursive: true })
  fs.mkdirSync(libNodeModules, { recursive: true })
  fs.symlinkSync(libNodeModules, path.join(binDir, "node_modules"), "dir")

  const result = spawnSync("bash", ["scripts/install.sh", "--uninstall", "--all", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 20000,
  })

  assert.equal(result.status, 0)
  assert.equal(fs.existsSync(path.join(binDir, "node_modules")), false)
})

test("install.sh uninstall accepts legacy manifest name", { timeout: 120000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-legacy-manifest-test-"))
  const codexHome = path.join(home, ".codex")
  const oldNs = "hyper" + "powers"

  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "opencode"), { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "agents"), { recursive: true })
  fs.mkdirSync(path.join(codexHome, "skills", "legacy-skill"), { recursive: true })
  fs.writeFileSync(path.join(codexHome, `.${oldNs}-manifest`), "skills/legacy-skill/\n", "utf8")
  fs.writeFileSync(path.join(codexHome, `.${oldNs}-version`), "test\n", "utf8")

  const result = spawnSync("bash", ["scripts/install.sh", "--uninstall", "--codex", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 20000,
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(fs.existsSync(path.join(codexHome, "skills", "legacy-skill")), false)
  assert.equal(fs.existsSync(path.join(codexHome, `.${oldNs}-manifest`)), false)
  assert.equal(fs.existsSync(path.join(codexHome, `.${oldNs}-version`)), false)
})

test("install.sh partial uninstall preserves shared tm runtime", { timeout: 120000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-test-"))
  const codexHome = path.join(home, ".codex")
  const binDir = path.join(home, ".local", "bin")
  const libDir = path.join(home, ".local", "lib", "tm")

  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "opencode"), { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "agents"), { recursive: true })
  fs.mkdirSync(codexHome, { recursive: true })
  fs.mkdirSync(binDir, { recursive: true })
  fs.mkdirSync(libDir, { recursive: true })
  fs.writeFileSync(path.join(codexHome, ".xpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(codexHome, ".xpowers-version"), "test\n", "utf8")
  fs.writeFileSync(path.join(binDir, "tm"), "#!/bin/sh\n", "utf8")
  fs.writeFileSync(path.join(binDir, "tm-linear-sync.js"), "sync\n", "utf8")
  fs.writeFileSync(path.join(binDir, "tm-linear-sync-config.js"), "config\n", "utf8")
  fs.mkdirSync(path.join(binDir, "node_modules"), { recursive: true })
  fs.writeFileSync(path.join(libDir, "tm-linear-sync.js"), "sync\n", "utf8")
  fs.writeFileSync(path.join(libDir, "tm-linear-sync-config.js"), "config\n", "utf8")

  const result = spawnSync("bash", ["scripts/install.sh", "--uninstall", "--codex", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 20000,
  })

  assert.equal(result.status, 0)
  assert.equal(fs.existsSync(path.join(binDir, "tm")), true)
  assert.equal(fs.existsSync(path.join(libDir, "tm-linear-sync.js")), true)
  assert.equal(fs.existsSync(path.join(binDir, "node_modules")), true)
})

test("install.sh opencode moves pre-existing node_modules directory aside and installs managed symlink", { timeout: 120000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-test-"))
  const binDir = path.join(home, ".local", "bin")
  const libDir = path.join(home, ".local", "lib", "tm")
  const opencodeHome = path.join(home, ".config", "opencode")

  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  fs.mkdirSync(opencodeHome, { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "agents"), { recursive: true })
  // Pre-create a real directory at ~/.local/bin/node_modules
  fs.mkdirSync(path.join(binDir, "node_modules", "some-pkg"), { recursive: true })

  const result = spawnSync("bash", ["scripts/install.sh", "--opencode", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 120000,
  })

  assert.equal(result.status, 0)
  const nmPath = path.join(binDir, "node_modules")
  const stat = fs.lstatSync(nmPath)
  assert.equal(stat.isSymbolicLink(), true, "node_modules should be a symlink, not a directory")
  assert.equal(fs.readlinkSync(nmPath), path.join(libDir, "node_modules"))
  const backupPath = path.join(binDir, "node_modules.xpowers-backup")
  assert.equal(fs.existsSync(backupPath), true)
  assert.equal(fs.existsSync(path.join(backupPath, "some-pkg")), true)
})

test("bun installer uninstall reads legacy manifest location", { timeout: 60000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-ts-legacy-manifest-test-"))
  const oldNs = "hyper" + "powers"
  const claudeHome = path.join(home, ".claude")
  const legacyManifestDir = path.join(home, `.${oldNs}`)
  const legacyFile = path.join(claudeHome, "legacy-file.txt")

  fs.mkdirSync(claudeHome, { recursive: true })
  fs.mkdirSync(legacyManifestDir, { recursive: true })
  fs.writeFileSync(legacyFile, "installed by old manifest\n", "utf8")
  fs.writeFileSync(
    path.join(legacyManifestDir, "manifest.json"),
    JSON.stringify({
      version: "legacy",
      installedAt: "2026-01-01T00:00:00Z",
      hosts: { claude: { targetDir: claudeHome, files: ["legacy-file.txt"] } },
      features: {},
    }, null, 2) + "\n",
    "utf8",
  )

  const result = spawnSync("bun", ["scripts/install.ts", "--uninstall", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 120000,
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(fs.existsSync(legacyFile), false)
  assert.equal(fs.existsSync(path.join(legacyManifestDir, "manifest.json")), false)
})

test("bun installer statusline uninstall removes legacy statusline path", { timeout: 60000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-ts-legacy-statusline-test-"))
  const oldNs = "hyper" + "powers"
  const claudeHome = path.join(home, ".claude")
  const manifestDir = path.join(home, ".xpowers")
  const settingsPath = path.join(claudeHome, "settings.json")

  fs.mkdirSync(claudeHome, { recursive: true })
  fs.mkdirSync(manifestDir, { recursive: true })
  fs.writeFileSync(settingsPath, JSON.stringify({ statusline: path.join(claudeHome, `${oldNs}-statusline.sh`) }, null, 2) + "\n", "utf8")
  fs.writeFileSync(
    path.join(manifestDir, "manifest.json"),
    JSON.stringify({
      version: "test",
      installedAt: "2026-01-01T00:00:00Z",
      hosts: {},
      features: { statusline: { installed: true } },
    }, null, 2) + "\n",
    "utf8",
  )

  const result = spawnSync("bun", ["scripts/install.ts", "--uninstall", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 120000,
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"))
  assert.equal(Object.hasOwn(settings, "statusline"), false)
})

test("pi installer replaces and removes legacy Pi AGENTS section markers", { timeout: 60000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-legacy-agents-test-"))
  const piHome = path.join(home, ".pi", "agent")
  const agentsPath = path.join(piHome, "AGENTS.md")
  const oldDisplay = "Hyper" + "powers"
  const trailingNotes = "User notes after legacy section"

  fs.mkdirSync(piHome, { recursive: true })
  fs.writeFileSync(
    agentsPath,
    [
      "# Existing Pi Instructions",
      "Keep this preface.",
      "",
      `<!-- BEGIN ${oldDisplay.toUpperCase()} PI -->`,
      `# ${oldDisplay} for Pi`,
      "Old installed content",
      `<!-- END ${oldDisplay.toUpperCase()} PI -->`,
      "",
      trailingNotes,
      "",
    ].join("\n"),
    "utf8",
  )

  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-legacy-bin-"))
  const piShimPath = path.join(tmpBinDir, "pi")
  fs.writeFileSync(piShimPath, "#!/bin/sh\nexit 0\n", "utf8")
  fs.chmodSync(piShimPath, 0o755)

  const env = installEnv(home, { PATH: `${tmpBinDir}:${process.env.PATH}` })
  const installResult = spawnSync("bun", ["scripts/install.ts", "--hosts", "pi", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    timeout: 120000,
  })

  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout)
  const installedAgents = fs.readFileSync(agentsPath, "utf8")
  assert.match(installedAgents, /<!-- BEGIN XPOWERS PI -->/)
  assert.match(installedAgents, /# XPowers for Pi/)
  assert.doesNotMatch(installedAgents, new RegExp(`# ${oldDisplay} for Pi`))
  assert.match(installedAgents, /Keep this preface\./)
  assert.match(installedAgents, new RegExp(trailingNotes))

  const uninstallResult = spawnSync("bun", ["scripts/install.ts", "--hosts", "pi", "--uninstall", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    timeout: 120000,
  })

  assert.equal(uninstallResult.status, 0, uninstallResult.stderr || uninstallResult.stdout)
  const uninstalledAgents = fs.readFileSync(agentsPath, "utf8")
  assert.doesNotMatch(uninstalledAgents, /<!-- BEGIN XPOWERS PI -->/)
  assert.doesNotMatch(uninstalledAgents, /# XPowers for Pi/)
  assert.match(uninstalledAgents, /Keep this preface\./)
  assert.match(uninstalledAgents, new RegExp(trailingNotes))

  fs.rmSync(tmpBinDir, { recursive: true, force: true })
})

test("pi installer preserves freeform trailing AGENTS.md content across reinstall and uninstall", { timeout: 60000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-agents-test-"))
  const piHome = path.join(home, ".pi", "agent")
  const agentsPath = path.join(piHome, "AGENTS.md")
  const trailingNotes = "User notes without heading\n- keep this list item\nplain trailing text"

  fs.mkdirSync(piHome, { recursive: true })
  fs.writeFileSync(
    agentsPath,
    [
      "# Existing Pi Instructions",
      "Keep the user's original preface.",
      "",
      "<!-- BEGIN XPOWERS PI -->",
      "# XPowers for Pi",
      "Old installed content",
      "<!-- END XPOWERS PI -->",
      "",
      trailingNotes,
      "",
    ].join("\n"),
    "utf8",
  )

  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-bin-"))
  const piShimPath = path.join(tmpBinDir, "pi")
  fs.writeFileSync(piShimPath, "#!/bin/sh\nexit 0\n", "utf8")
  fs.chmodSync(piShimPath, 0o755)

  const env = installEnv(home, { PATH: `${tmpBinDir}:${process.env.PATH}` })

  const installResult = spawnSync("bun", ["scripts/install.ts", "--hosts", "pi", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    timeout: 120000,
  })

  assert.equal(installResult.status, 0)
  const installedAgents = fs.readFileSync(agentsPath, "utf8")
  assert.match(installedAgents, /<!-- BEGIN XPOWERS PI -->/)
  assert.match(installedAgents, /# XPowers for Pi/)
  assert.match(installedAgents, /User notes without heading/)
  assert.match(installedAgents, /plain trailing text/)

  const uninstallResult = spawnSync("bun", ["scripts/install.ts", "--hosts", "pi", "--uninstall", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    timeout: 120000,
  })

  assert.equal(uninstallResult.status, 0)
  const uninstalledAgents = fs.readFileSync(agentsPath, "utf8")
  assert.doesNotMatch(uninstalledAgents, /<!-- BEGIN XPOWERS PI -->/)
  assert.doesNotMatch(uninstalledAgents, /# XPowers for Pi/)
  assert.match(uninstalledAgents, /Keep the user's original preface\./)
  assert.match(uninstalledAgents, /User notes without heading/)
  assert.match(uninstalledAgents, /plain trailing text/)

  fs.rmSync(tmpBinDir, { recursive: true, force: true })
})

test("pi installer rolls back AGENTS.md if a later Pi postInstall step fails", { timeout: 60000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-agents-rollback-test-"))
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-agents-rollback-bin-"))
  const piHome = path.join(home, ".pi", "agent")
  const piShimPath = path.join(tmpBinDir, "pi")
  const bunPath = spawnSync("bash", ["-lc", "command -v bun"], { encoding: "utf8" }).stdout.trim()
  const agentsPath = path.join(piHome, "AGENTS.md")
  const extDir = path.join(piHome, "extensions", "xpowers")
  const skillsPath = path.join(extDir, "skills")
  const originalAgents = "# Existing Pi Instructions\nKeep this untouched if install fails after AGENTS update.\n"

  fs.mkdirSync(extDir, { recursive: true })
  fs.writeFileSync(agentsPath, originalAgents, "utf8")
  fs.symlinkSync("/dev/full", skillsPath)
  fs.writeFileSync(piShimPath, "#!/bin/sh\nexit 0\n", "utf8")
  fs.chmodSync(piShimPath, 0o755)
  fs.writeFileSync(path.join(tmpBinDir, "bun"), "#!/bin/sh\nexit 0\n", "utf8")
  fs.chmodSync(path.join(tmpBinDir, "bun"), 0o755)

  const result = spawnSync(bunPath, ["scripts/install.ts", "--hosts", "pi", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home, { PATH: `${tmpBinDir}:${process.env.PATH}` }),
    timeout: 120000,
  })

  assert.notEqual(result.status, 0)
  assert.equal(fs.readFileSync(agentsPath, "utf8"), originalAgents)
  assert.equal(fs.lstatSync(skillsPath).isSymbolicLink(), true)

  fs.rmSync(tmpBinDir, { recursive: true, force: true })
})

test("pi installer fails when dependency install tooling is unavailable", { timeout: 30000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-deps-test-"))
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-bin-"))
  const piHome = path.join(home, ".pi", "agent")
  const piShimPath = path.join(tmpBinDir, "pi")
  const agentsPath = path.join(piHome, "AGENTS.md")
  const extensionPath = path.join(piHome, "extensions", "xpowers")
  const bunPath = spawnSync("bash", ["-lc", "command -v bun"], { encoding: "utf8" }).stdout.trim()
  const originalAgents = "# Existing Pi Instructions\nKeep this untouched when install fails.\n"

  fs.mkdirSync(piHome, { recursive: true })
  fs.writeFileSync(agentsPath, originalAgents, "utf8")
  fs.writeFileSync(piShimPath, "#!/bin/sh\nexit 0\n", "utf8")
  fs.chmodSync(piShimPath, 0o755)
  fs.symlinkSync(bunPath, path.join(tmpBinDir, "bun"))

  const result = spawnSync("bun", ["scripts/install.ts", "--hosts", "pi", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home, { PATH: tmpBinDir }),
    timeout: 120000,
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr + result.stdout, /Pi install requires bun to build the extension|Pi extension dependency install failed/)
  assert.equal(fs.readFileSync(agentsPath, "utf8"), originalAgents)
  assert.equal(fs.existsSync(extensionPath), false)

  fs.rmSync(tmpBinDir, { recursive: true, force: true })
})

test("pi installer json mode reports failure when host install fails", { timeout: 30000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-json-fail-test-"))
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-json-bin-"))
  const piHome = path.join(home, ".pi", "agent")
  const piShimPath = path.join(tmpBinDir, "pi")
  const bunPath = spawnSync("bash", ["-lc", "command -v bun"], { encoding: "utf8" }).stdout.trim()

  fs.mkdirSync(piHome, { recursive: true })
  fs.writeFileSync(piShimPath, "#!/bin/sh\nexit 0\n", "utf8")
  fs.chmodSync(piShimPath, 0o755)
  fs.symlinkSync(bunPath, path.join(tmpBinDir, "bun"))

  const result = spawnSync(bunPath, ["scripts/install.ts", "--hosts", "pi", "--features", "__none__", "--yes", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home, { PATH: tmpBinDir }),
    timeout: 120000,
  })

  assert.notEqual(result.status, 0)
  const payload = JSON.parse(result.stdout.trim())
  assert.equal(payload.ok, false)
  assert.equal(Array.isArray(payload.hosts), true)

  fs.rmSync(tmpBinDir, { recursive: true, force: true })
})

test("pi installer rollback preserves pre-existing extension files on failure", { timeout: 30000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-existing-ext-test-"))
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-pi-existing-ext-bin-"))
  const piHome = path.join(home, ".pi", "agent")
  const piShimPath = path.join(tmpBinDir, "pi")
  const extDir = path.join(piHome, "extensions", "xpowers")
  const routingPath = path.join(extDir, "routing.json")
  const bunPath = spawnSync("bash", ["-lc", "command -v bun"], { encoding: "utf8" }).stdout.trim()
  const originalRouting = '{\n  "default": "existing-model"\n}\n'

  fs.mkdirSync(extDir, { recursive: true })
  fs.writeFileSync(routingPath, originalRouting, "utf8")
  fs.writeFileSync(piShimPath, "#!/bin/sh\nexit 0\n", "utf8")
  fs.chmodSync(piShimPath, 0o755)
  fs.symlinkSync(bunPath, path.join(tmpBinDir, "bun"))

  const result = spawnSync("bun", ["scripts/install.ts", "--hosts", "pi", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home, { PATH: tmpBinDir }),
    timeout: 120000,
  })

  assert.notEqual(result.status, 0)
  assert.equal(fs.existsSync(extDir), true)
  assert.equal(fs.readFileSync(routingPath, "utf8"), originalRouting)

  fs.rmSync(tmpBinDir, { recursive: true, force: true })
})

test("install.sh opencode provisions tm runtime and OpenCode command surface", { timeout: 120000 }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-test-"))
  const opencodeHome = path.join(home, ".config", "opencode")

  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  fs.mkdirSync(opencodeHome, { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "agents"), { recursive: true })

  const result = spawnSync("bash", ["scripts/install.sh", "--opencode", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: installEnv(home),
    timeout: 120000,
  })

  assert.equal(result.status, 0)
  assert.equal(fs.existsSync(path.join(home, ".local", "bin", "tm")), true)
  assert.equal(fs.existsSync(path.join(home, ".local", "lib", "tm", "tm-linear-sync.js")), true)
  assert.equal(fs.existsSync(path.join(opencodeHome, "commands", "tm-linear-setup.md")), true)
  assert.equal(fs.existsSync(path.join(opencodeHome, "package.json")), true)
})
