const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const fs = require("node:fs")
const os = require("node:os")
const { spawnSync } = require("node:child_process")

const repoRoot = path.resolve(__dirname, "..")
const tmPath = path.resolve(repoRoot, "scripts/tm")
const tmBackendsPath = path.resolve(repoRoot, "scripts/tm-backends.sh")

function createMockBackend(tmpDir, name) {
  const binDir = path.join(tmpDir, "bin")
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true })
  }
  const mockPath = path.join(binDir, name)
  const logPath = path.join(tmpDir, `${name}.log`)
  fs.writeFileSync(mockPath, `#!/usr/bin/env bash
echo "$@" >> ${logPath}
`)
  fs.chmodSync(mockPath, 0o755)
  return { mockPath, logPath, binDir }
}

test("TM_BACKEND=br tm create translates --design to --description", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-mapping-test-"))
  try {
    const { logPath, binDir } = createMockBackend(tmpDir, "br")
    
    // We need scripts/tm to be able to find tm-backends.sh
    // So we copy them to a fake scripts dir in tmpDir
    const fakeScriptsDir = path.join(tmpDir, "scripts")
    fs.mkdirSync(fakeScriptsDir, { recursive: true })
    fs.copyFileSync(tmPath, path.join(fakeScriptsDir, "tm"))
    fs.copyFileSync(tmBackendsPath, path.join(fakeScriptsDir, "tm-backends.sh"))
    const fakeTmPath = path.join(fakeScriptsDir, "tm")
    fs.chmodSync(fakeTmPath, 0o755)

    const env = {
      ...process.env,
      TM_BACKEND: "br",
      PATH: `${binDir}:${process.env.PATH}`,
      TM_REPO_ROOT: tmpDir // ensure it finds a repo root
    }
    // Create .beads dir to make it a repo root
    fs.mkdirSync(path.join(tmpDir, ".beads"), { recursive: true })

    const result = spawnSync(fakeTmPath, ["create", "My Task", "--design", "My Design"], {
      cwd: tmpDir,
      env,
      encoding: "utf8"
    })

    assert.strictEqual(result.status, 0, result.stderr)
    const log = fs.readFileSync(logPath, "utf8").trim()
    assert.strictEqual(log, "create My Task --description My Design")
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test("TM_BACKEND=br tm create translates --design-file to --description with file content", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-mapping-test-"))
  try {
    const { logPath, binDir } = createMockBackend(tmpDir, "br")
    
    const fakeScriptsDir = path.join(tmpDir, "scripts")
    fs.mkdirSync(fakeScriptsDir, { recursive: true })
    fs.copyFileSync(tmPath, path.join(fakeScriptsDir, "tm"))
    fs.copyFileSync(tmBackendsPath, path.join(fakeScriptsDir, "tm-backends.sh"))
    const fakeTmPath = path.join(fakeScriptsDir, "tm")
    fs.chmodSync(fakeTmPath, 0o755)

    const designPath = path.join(tmpDir, "design.md")
    fs.writeFileSync(designPath, "Content from file")

    const env = {
      ...process.env,
      TM_BACKEND: "br",
      PATH: `${binDir}:${process.env.PATH}`,
      TM_REPO_ROOT: tmpDir
    }
    fs.mkdirSync(path.join(tmpDir, ".beads"), { recursive: true })

    const result = spawnSync(fakeTmPath, ["create", "My Task", "--design-file", designPath], {
      cwd: tmpDir,
      env,
      encoding: "utf8"
    })

    assert.strictEqual(result.status, 0, result.stderr)
    const log = fs.readFileSync(logPath, "utf8").trim()
    assert.strictEqual(log, "create My Task --description Content from file")
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test("TM_BACKEND=br tm update does NOT translate --design", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-mapping-test-"))
  try {
    const { logPath, binDir } = createMockBackend(tmpDir, "br")
    
    const fakeScriptsDir = path.join(tmpDir, "scripts")
    fs.mkdirSync(fakeScriptsDir, { recursive: true })
    fs.copyFileSync(tmPath, path.join(fakeScriptsDir, "tm"))
    fs.copyFileSync(tmBackendsPath, path.join(fakeScriptsDir, "tm-backends.sh"))
    const fakeTmPath = path.join(fakeScriptsDir, "tm")
    fs.chmodSync(fakeTmPath, 0o755)

    const env = {
      ...process.env,
      TM_BACKEND: "br",
      PATH: `${binDir}:${process.env.PATH}`,
      TM_REPO_ROOT: tmpDir
    }
    fs.mkdirSync(path.join(tmpDir, ".beads"), { recursive: true })

    const result = spawnSync(fakeTmPath, ["update", "task-1", "--design", "New Design"], {
      cwd: tmpDir,
      env,
      encoding: "utf8"
    })

    assert.strictEqual(result.status, 0, result.stderr)
    const log = fs.readFileSync(logPath, "utf8").trim()
    assert.strictEqual(log, "update task-1 --design New Design")
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test("TM_BACKEND=bd tm create does NOT translate --design", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-mapping-test-"))
  try {
    const { logPath, binDir } = createMockBackend(tmpDir, "bd")
    
    const fakeScriptsDir = path.join(tmpDir, "scripts")
    fs.mkdirSync(fakeScriptsDir, { recursive: true })
    fs.copyFileSync(tmPath, path.join(fakeScriptsDir, "tm"))
    fs.copyFileSync(tmBackendsPath, path.join(fakeScriptsDir, "tm-backends.sh"))
    const fakeTmPath = path.join(fakeScriptsDir, "tm")
    fs.chmodSync(fakeTmPath, 0o755)

    const env = {
      ...process.env,
      TM_BACKEND: "bd",
      PATH: `${binDir}:${process.env.PATH}`,
      TM_REPO_ROOT: tmpDir
    }
    fs.mkdirSync(path.join(tmpDir, ".beads"), { recursive: true })

    const result = spawnSync(fakeTmPath, ["create", "My Task", "--design", "My Design"], {
      cwd: tmpDir,
      env,
      encoding: "utf8"
    })

    assert.strictEqual(result.status, 0, result.stderr)
    const log = fs.readFileSync(logPath, "utf8").trim()
    assert.strictEqual(log, "create My Task --design My Design")
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
