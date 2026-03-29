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

test("tm with TM_BACKEND=br explicitly selects br backend", () => {
  const result = runTm(["--version"], { env: { TM_BACKEND: "br" } })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /backend: br/)
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
  assert.match(result.stderr, /Valid backends: bd, br, linear/)
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

test("tm discovers repo config from the script location when cwd is outside the repo", () => {
  const os = require("node:os")
  const fs = require("node:fs")
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tm-script-root-"))
  const fakeRepo = path.join(tmpRoot, "fake-repo")
  const fakeScriptDir = path.join(fakeRepo, "scripts")
  const fakeBeadsDir = path.join(fakeRepo, ".beads")
  const outsideDir = path.join(tmpRoot, "outside")
  const fakeTmPath = path.join(fakeScriptDir, "tm")

  try {
    fs.mkdirSync(fakeScriptDir, { recursive: true })
    fs.mkdirSync(fakeBeadsDir, { recursive: true })
    fs.mkdirSync(outsideDir)
    fs.copyFileSync(tmPath, fakeTmPath)
    fs.chmodSync(fakeTmPath, 0o755)
    fs.writeFileSync(path.join(fakeBeadsDir, "config.yaml"), 'tm.backend: "linear"\n')

    const result = spawnSync(fakeTmPath, ["--version"], {
      cwd: outsideDir,
      encoding: "utf8",
      env: { ...process.env, TM_BACKEND: "" },
      timeout: 10000,
    })

    assert.equal(result.status, 0)
    assert.match(result.stdout, /backend: linear/)
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
})

test("tm passes through arguments unchanged to bd", (t) => {
  const bdPath = findCommandPath("bd")
  if (!bdPath) {
    t.skip("bd not available on PATH in this environment")
    return
  }

  // Running 'tm list --status open' should produce the same output as 'bd list --status open'
  const tmResult = runTm(["list", "--status", "open"])
  const bdResult = spawnSync(bdPath, ["list", "--status", "open"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10000,
  })
  assert.equal(tmResult.status, bdResult.status)
  assert.equal(tmResult.stdout, bdResult.stdout)
})

test("tm sync --help matches bd sync --help without running Linear sync", (t) => {
  const bdPath = findCommandPath("bd")
  if (!bdPath) {
    t.skip("bd not available on PATH in this environment")
    return
  }

  const tmResult = runTm(["sync", "--help"], { env: { LINEAR_API_KEY: "" } })
  const bdResult = spawnSync(bdPath, ["sync", "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10000,
  })

  assert.equal(tmResult.status, bdResult.status)
  assert.equal(tmResult.stdout, bdResult.stdout)
  assert.equal(tmResult.stderr, bdResult.stderr)
})

test("tm sync fails when Linear is configured but node is unavailable", () => {
  const os = require("node:os")
  const fs = require("node:fs")
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-sync-no-node-"))
  const bashPath = findCommandPath("bash") || "/bin/bash"

  try {
    for (const commandName of ["awk", "dirname", "grep"]) {
      const commandPath = findCommandPath(commandName)
      assert.ok(commandPath, `Could not find ${commandName} on PATH`)
      fs.symlinkSync(commandPath, path.join(tmpBinDir, commandName))
    }

    const fakeBdPath = path.join(tmpBinDir, "bd")
    fs.writeFileSync(fakeBdPath, `#!${bashPath}\nif [[ \"$1\" == \"sync\" ]]; then exit 0; fi\nexit 0\n`)
    fs.chmodSync(fakeBdPath, 0o755)

    const result = spawnSync(bashPath, [tmPath, "sync"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        TM_BACKEND: "bd",
        PATH: tmpBinDir,
        LINEAR_API_KEY: "lin_api_test123",
        LINEAR_TEAM_KEY: "ENG",
      },
      timeout: 10000,
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Linear sync is configured but Node\.js is unavailable/)
  } finally {
    fs.rmSync(tmpBinDir, { recursive: true, force: true })
  }
})

test("tm sync skips Linear when only team key is present and node is unavailable", () => {
  const os = require("node:os")
  const fs = require("node:fs")
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-sync-team-only-"))
  const bashPath = findCommandPath("bash") || "/bin/bash"

  try {
    for (const commandName of ["awk", "dirname", "grep"]) {
      const commandPath = findCommandPath(commandName)
      assert.ok(commandPath, `Could not find ${commandName} on PATH`)
      fs.symlinkSync(commandPath, path.join(tmpBinDir, commandName))
    }

    const fakeBdPath = path.join(tmpBinDir, "bd")
    fs.writeFileSync(fakeBdPath, `#!${bashPath}\nif [[ \"$1\" == \"sync\" ]]; then exit 0; fi\nexit 0\n`)
    fs.chmodSync(fakeBdPath, 0o755)

    const result = spawnSync(bashPath, [tmPath, "sync"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        TM_BACKEND: "bd",
        PATH: tmpBinDir,
        LINEAR_API_KEY: "",
        LINEAR_TEAM_KEY: "ENG",
      },
      timeout: 10000,
    })

    assert.equal(result.status, 0)
    assert.equal(result.stderr, "")
  } finally {
    fs.rmSync(tmpBinDir, { recursive: true, force: true })
  }
})

test("tm sync detects Linear config from backend config when env vars are unset", () => {
  const os = require("node:os")
  const fs = require("node:fs")
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-sync-backend-config-"))
  const bashPath = findCommandPath("bash") || "/bin/bash"

  try {
    for (const commandName of ["awk", "dirname", "grep"]) {
      const commandPath = findCommandPath(commandName)
      assert.ok(commandPath, `Could not find ${commandName} on PATH`)
      fs.symlinkSync(commandPath, path.join(tmpBinDir, commandName))
    }

    const fakeBdPath = path.join(tmpBinDir, "bd")
    fs.writeFileSync(
      fakeBdPath,
      `#!${bashPath}
if [[ "$1" == "sync" ]]; then exit 0; fi
if [[ "$1" == "config" && "$2" == "get" ]]; then
  if [[ "$3" == "linear.api-key" ]]; then echo "lin_api_cfg"; exit 0; fi
  if [[ "$3" == "linear.team-key" ]]; then echo "ENG"; exit 0; fi
  echo "$3 (not set)"
  exit 0
fi
exit 0
`,
    )
    fs.chmodSync(fakeBdPath, 0o755)

    const env = {
      ...process.env,
      TM_BACKEND: "bd",
      PATH: tmpBinDir,
    }
    delete env.LINEAR_API_KEY
    delete env.LINEAR_TEAM_KEY

    const result = spawnSync(bashPath, [tmPath, "sync"], {
      cwd: repoRoot,
      encoding: "utf8",
      env,
      timeout: 10000,
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Linear sync is configured but Node\.js is unavailable/)
  } finally {
    fs.rmSync(tmpBinDir, { recursive: true, force: true })
  }
})

test("tm sync ignores similarly named config keys when checking linear.api-key", () => {
  const os = require("node:os")
  const fs = require("node:fs")
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-sync-literal-key-"))
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "tm-sync-literal-repo-"))
  const bashPath = findCommandPath("bash") || "/bin/bash"

  try {
    fs.mkdirSync(path.join(tmpRepo, ".beads"), { recursive: true })
    fs.writeFileSync(path.join(tmpRepo, ".beads", "config.yaml"), "linearXapi-key: wrong_key\n")

    for (const commandName of ["awk", "dirname", "grep"]) {
      const commandPath = findCommandPath(commandName)
      assert.ok(commandPath, `Could not find ${commandName} on PATH`)
      fs.symlinkSync(commandPath, path.join(tmpBinDir, commandName))
    }

    const fakeBdPath = path.join(tmpBinDir, "bd")
    fs.writeFileSync(
      fakeBdPath,
      `#!${bashPath}
if [[ "$1" == "sync" ]]; then exit 0; fi
if [[ "$1" == "config" && "$2" == "get" ]]; then
  echo "$3 (not set)"
  exit 0
fi
exit 0
`,
    )
    fs.chmodSync(fakeBdPath, 0o755)

    const env = {
      ...process.env,
      TM_BACKEND: "bd",
      PATH: tmpBinDir,
    }
    delete env.LINEAR_API_KEY
    delete env.LINEAR_TEAM_KEY

    const result = spawnSync(bashPath, [tmPath, "sync"], {
      cwd: tmpRepo,
      encoding: "utf8",
      env,
      timeout: 10000,
    })

    assert.equal(result.status, 0)
    assert.equal(result.stderr, "")
  } finally {
    fs.rmSync(tmpBinDir, { recursive: true, force: true })
    fs.rmSync(tmpRepo, { recursive: true, force: true })
  }
})

test("tm passes arguments with spaces unchanged to bd", () => {
  const os = require("node:os")
  const fs = require("node:fs")
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-test-"))
  const tmpBeads = path.join(tmpDir, ".beads")
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-test-bin-"))
  const bashPath = findCommandPath("bash") || "/bin/bash"

  try {
    fs.mkdirSync(tmpBeads)

    for (const commandName of ["awk", "bash", "cat", "dirname", "grep"]) {
      const commandPath = findCommandPath(commandName)
      assert.ok(commandPath, `Could not find ${commandName} on PATH`)
      fs.symlinkSync(commandPath, path.join(tmpBinDir, commandName))
    }

    const fakeBdPath = path.join(tmpBinDir, "bd")
    fs.writeFileSync(
      fakeBdPath,
      `#!${bashPath}
set -euo pipefail
store="${tmpDir}/issues.txt"
command="$1"
shift || true

case "$command" in
  create)
    title="$1"
    shift
    design=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --design)
          design="$2"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done
    printf '%s\n%s\n' "$title" "$design" > "$store"
    printf '✓ Created issue: tmtest-1 — %s\n' "$title"
    ;;
  show)
    issue_id="$1"
    [[ "$issue_id" == "tmtest-1" ]] || exit 0
    cat "$store"
    ;;
  close)
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
`,
    )
    fs.chmodSync(fakeBdPath, 0o755)

    const env = { ...process.env, TM_BACKEND: "bd", PATH: tmpBinDir }
    const title = "TM test issue with spaces"
    const design = "Multi word design for testing"
    const createResult = runTm([
      "create", title,
      "--type", "task",
      "--priority", "4",
      "--design", design,
    ], { cwd: tmpDir, env })
    assert.equal(createResult.status, 0, `tm create failed: ${createResult.stderr}`)

    const idMatch = createResult.stdout.match(/(\S+-[0-9a-z]+)/)
    assert.ok(idMatch, `Could not find issue ID in output: ${createResult.stdout}`)
    const issueId = idMatch[1]

    const showResult = runTm(["show", issueId], { cwd: tmpDir, env })
    assert.equal(showResult.status, 0)
    assert.ok(showResult.stdout.includes(title), `Title not found in show output`)
    assert.ok(showResult.stdout.includes(design), `Design not found in show output`)

    runTm(["close", issueId, "--reason", "test cleanup"], { cwd: tmpDir, env })
  } finally {
    fs.rmSync(tmpBinDir, { recursive: true, force: true })
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test("tm when bd not in PATH gives helpful error message", () => {
  const os = require("node:os")
  const fs = require("node:fs")
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-no-bd-"))

  try {
    const bashPath = findCommandPath("bash") || "/bin/bash"
    for (const commandName of ["awk", "dirname", "grep"]) {
      const commandPath = findCommandPath(commandName)
      assert.ok(commandPath, `Could not find ${commandName} on PATH`)
      fs.symlinkSync(commandPath, path.join(tmpBinDir, commandName))
    }

    const result = spawnSync(bashPath, [tmPath, "ready"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, TM_BACKEND: "bd", PATH: tmpBinDir },
      timeout: 10000,
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /bd not found in PATH/)
  } finally {
    fs.rmSync(tmpBinDir, { recursive: true, force: true })
  }
})

test("tm when br not in PATH gives helpful error message", () => {
  const os = require("node:os")
  const fs = require("node:fs")
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-no-br-"))

  try {
    const bashPath = findCommandPath("bash") || "/bin/bash"
    for (const commandName of ["awk", "dirname", "grep"]) {
      const commandPath = findCommandPath(commandName)
      assert.ok(commandPath, `Could not find ${commandName} on PATH`)
      fs.symlinkSync(commandPath, path.join(tmpBinDir, commandName))
    }

    const result = spawnSync(bashPath, [tmPath, "ready"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, TM_BACKEND: "br", PATH: tmpBinDir },
      timeout: 10000,
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /br not found in PATH/)
  } finally {
    fs.rmSync(tmpBinDir, { recursive: true, force: true })
  }
})

test("tm sync under br performs local flush and reports unsupported follow-on sync", () => {
  const os = require("node:os")
  const fs = require("node:fs")
  const tmpBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-br-sync-"))
  const argsCapturePath = path.join(tmpBinDir, "br-args.txt")
  const bashPath = findCommandPath("bash") || "/bin/bash"

  try {
    for (const commandName of ["awk", "dirname", "grep", "head"]) {
      const commandPath = findCommandPath(commandName)
      assert.ok(commandPath, `Could not find ${commandName} on PATH`)
      fs.symlinkSync(commandPath, path.join(tmpBinDir, commandName))
    }

    const fakeBrPath = path.join(tmpBinDir, "br")
    fs.writeFileSync(fakeBrPath, `#!${bashPath}\nprintf '%s\\n' \"$*\" > \"${argsCapturePath}\"\nif [[ \"$1\" == \"sync\" ]]; then exit 0; fi\nexit 0\n`)
    fs.chmodSync(fakeBrPath, 0o755)

    const result = spawnSync(bashPath, [tmPath, "sync"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        TM_BACKEND: "br",
        PATH: tmpBinDir,
        LINEAR_API_KEY: "lin_api_test123",
        LINEAR_TEAM_KEY: "ENG",
      },
      timeout: 10000,
    })

    assert.equal(result.status, 0)
    assert.equal(fs.existsSync(argsCapturePath), true)
    assert.match(fs.readFileSync(argsCapturePath, "utf8"), /^sync --flush-only/)
    assert.match(result.stderr, /not supported for backend 'br'/)
    assert.match(result.stderr, /follow-on sync was skipped/)
  } finally {
    fs.rmSync(tmpBinDir, { recursive: true, force: true })
  }
})

function findCommandPath(commandName) {
  const fs = require("node:fs")
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue
    const fullPath = path.join(dir, commandName)
    try {
      fs.accessSync(fullPath, fs.constants.X_OK)
      return fullPath
    } catch {
      continue
    }
  }
  return null
}
