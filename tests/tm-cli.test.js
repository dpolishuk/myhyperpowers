const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const repoRoot = path.resolve(__dirname, "..")
const tmPath = path.resolve(repoRoot, "scripts/tm")

function runTm(args = [], opts = {}) {
  return spawnSync(tmPath, args, {
    cwd: opts.cwd || repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...opts.env },
    timeout: 10000,
  })
}

test("tm with no config defaults to bd backend", () => {
  // Running tm --version without TM_BACKEND should show "bd" as backend
  const result = runTm(["--version"], { env: { TM_BACKEND: "" } })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /backend: bd/)
})

test("tm with TM_BACKEND=bd explicitly selects bd backend", () => {
  const result = runTm(["--version"], { env: { TM_BACKEND: "bd" } })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /backend: bd/)
})

test("tm with TM_BACKEND=linear exits with not-implemented error", () => {
  // linear backend should fail gracefully with a helpful message
  const result = runTm(["ready"], { env: { TM_BACKEND: "linear" } })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Linear backend not yet implemented/)
})

test("tm with TM_BACKEND=invalid exits with unknown-backend error", () => {
  const result = runTm(["ready"], { env: { TM_BACKEND: "gitlab" } })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /unknown backend 'gitlab'/)
  assert.match(result.stderr, /Valid backends: bd, linear/)
})

test("tm --help shows usage and configured backend", () => {
  const result = runTm(["--help"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Abstract Task Manager CLI/)
  assert.match(result.stdout, /Currently configured backend:/)
  assert.match(result.stdout, /tm ready/)
})

test("tm --version shows version and backend", () => {
  const result = runTm(["--version"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /^tm \d+\.\d+\.\d+ \(backend: \w+\)/)
})

test("tm passes through arguments unchanged to bd", () => {
  // Running 'tm list --status open' should produce the same output as 'bd list --status open'
  const tmResult = runTm(["list", "--status", "open"])
  const bdResult = spawnSync("bd", ["list", "--status", "open"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10000,
  })
  assert.equal(tmResult.status, bdResult.status)
  assert.equal(tmResult.stdout, bdResult.stdout)
})

test("tm passes arguments with spaces unchanged to bd", () => {
  // Use a temp directory with its own .beads to avoid polluting repo state
  const os = require("node:os")
  const fs = require("node:fs")
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-test-"))
  const tmpBeads = path.join(tmpDir, ".beads")
  fs.mkdirSync(tmpBeads)
  // Initialize minimal beads DB
  spawnSync("bd", ["init"], { cwd: tmpDir, encoding: "utf8", timeout: 10000 })

  const title = "TM test issue with spaces"
  const design = "Multi word design for testing"
  const createResult = runTm([
    "create", title,
    "--type", "task",
    "--priority", "4",
    "--design", design,
  ], { cwd: tmpDir })
  assert.equal(createResult.status, 0, `tm create failed: ${createResult.stderr}`)

  // Extract issue ID from output (prefix varies by repo)
  const idMatch = createResult.stdout.match(/(\S+-[0-9a-z]+)/)
  assert.ok(idMatch, `Could not find issue ID in output: ${createResult.stdout}`)
  const issueId = idMatch[1]

  // Verify the title and design were preserved
  const showResult = runTm(["show", issueId], { cwd: tmpDir })
  assert.equal(showResult.status, 0)
  assert.ok(showResult.stdout.includes(title), `Title not found in show output`)
  assert.ok(showResult.stdout.includes(design), `Design not found in show output`)

  // Clean up
  runTm(["close", issueId, "--reason", "test cleanup"], { cwd: tmpDir })
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test("tm when bd not in PATH gives helpful error message", () => {
  // Run tm with a PATH that doesn't include bd
  const result = runTm(["ready"], {
    env: { TM_BACKEND: "bd", PATH: "/usr/bin" },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /bd not found in PATH/)
})
