const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const fs = require("node:fs")
const os = require("node:os")
const { spawnSync } = require("node:child_process")

const repoRoot = path.resolve(__dirname, "..")

test("install.sh full uninstall handles a directory at ~/.local/bin/node_modules", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-test-"))
  const codexHome = path.join(home, ".codex")
  const binDir = path.join(home, ".local", "bin")
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "opencode"), { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "agents"), { recursive: true })

  fs.mkdirSync(codexHome, { recursive: true })
  fs.writeFileSync(path.join(codexHome, ".hyperpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(codexHome, ".hyperpowers-version"), "test\n", "utf8")
  fs.mkdirSync(path.join(binDir, "node_modules"), { recursive: true })

  fs.writeFileSync(path.join(home, ".claude", ".hyperpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(home, ".claude", ".hyperpowers-version"), "test\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "opencode", ".hyperpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "opencode", ".hyperpowers-version"), "test\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "agents", ".hyperpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(home, ".config", "agents", ".hyperpowers-version"), "test\n", "utf8")

  const result = spawnSync("bash", ["scripts/install.sh", "--uninstall", "--all", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, HOME: home, NO_COLOR: "1" },
    timeout: 20000,
  })

  assert.equal(result.status, 0)
  assert.equal(fs.existsSync(path.join(binDir, "node_modules")), false)
})

test("install.sh partial uninstall preserves shared tm runtime", () => {
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
  fs.writeFileSync(path.join(codexHome, ".hyperpowers-manifest"), "# test manifest\n", "utf8")
  fs.writeFileSync(path.join(codexHome, ".hyperpowers-version"), "test\n", "utf8")
  fs.writeFileSync(path.join(binDir, "tm"), "#!/bin/sh\n", "utf8")
  fs.writeFileSync(path.join(binDir, "tm-linear-sync.js"), "sync\n", "utf8")
  fs.writeFileSync(path.join(binDir, "tm-linear-sync-config.js"), "config\n", "utf8")
  fs.mkdirSync(path.join(binDir, "node_modules"), { recursive: true })
  fs.writeFileSync(path.join(libDir, "tm-linear-sync.js"), "sync\n", "utf8")
  fs.writeFileSync(path.join(libDir, "tm-linear-sync-config.js"), "config\n", "utf8")

  const result = spawnSync("bash", ["scripts/install.sh", "--uninstall", "--codex", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, HOME: home, NO_COLOR: "1" },
    timeout: 20000,
  })

  assert.equal(result.status, 0)
  assert.equal(fs.existsSync(path.join(binDir, "tm")), true)
  assert.equal(fs.existsSync(path.join(libDir, "tm-linear-sync.js")), true)
  assert.equal(fs.existsSync(path.join(binDir, "node_modules")), true)
})

test("install.sh opencode provisions tm runtime and OpenCode command surface", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-test-"))
  const opencodeHome = path.join(home, ".config", "opencode")

  fs.mkdirSync(path.join(home, ".claude"), { recursive: true })
  fs.mkdirSync(opencodeHome, { recursive: true })
  fs.mkdirSync(path.join(home, ".config", "agents"), { recursive: true })

  const result = spawnSync("bash", ["scripts/install.sh", "--opencode", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, HOME: home, NO_COLOR: "1" },
    timeout: 120000,
  })

  assert.equal(result.status, 0)
  assert.equal(fs.existsSync(path.join(home, ".local", "bin", "tm")), true)
  assert.equal(fs.existsSync(path.join(home, ".local", "lib", "tm", "tm-linear-sync.js")), true)
  assert.equal(fs.existsSync(path.join(opencodeHome, "commands", "tm-linear-setup.md")), true)
  assert.equal(fs.existsSync(path.join(opencodeHome, "package.json")), true)
})
