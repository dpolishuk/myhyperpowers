import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { test, expect } from "bun:test"

const repoRoot = path.resolve(__dirname, "..")

function createFakePiShim(binDir: string): void {
  const piPath = path.join(binDir, "pi")
  writeFileSync(piPath, "#!/bin/sh\nexit 0\n", "utf8")
  chmodSync(piPath, 0o755)
}

function newTempDir(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), `${prefix}-XXXXXX`))
}

async function installAndLoadCommands() {
  const home = newTempDir("pi-command-handlers")
  const binDir = newTempDir("pi-command-handlers-bin")
  createFakePiShim(binDir)
  const bunPath = spawnSync("bash", ["-lc", "command -v bun"], { encoding: "utf8" }).stdout.trim()

  const env = {
    ...process.env,
    HOME: home,
    NO_COLOR: "1",
    PATH: `${binDir}:${process.env.PATH}`,
  }

  const result = spawnSync(bunPath, ["scripts/install.ts", "--hosts", "pi", "--yes"], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    timeout: 180000,
  })

  expect(result.status).toBe(0)

  const indexPath = path.join(home, ".pi", "agent", "extensions", "hyperpowers", "index.ts")
  expect(existsSync(indexPath)).toBe(true)

  const mod = await import(pathToFileURL(indexPath).href)
  const commands = new Map<string, any>()
  const mockPi: any = {
    registerCommand: (name: string, spec: any) => commands.set(name, spec),
    registerTool: () => {},
    on: () => {},
  }
  mod.default(mockPi)

  return {
    commands,
    cleanup: () => {
      rmSync(home, { recursive: true, force: true })
      rmSync(binDir, { recursive: true, force: true })
    },
  }
}

test("execute-ralph command uses command doc wrapper and forwards args", async () => {
  const { commands, cleanup } = await installAndLoadCommands()
  try {
    const executeRalph = commands.get("execute-ralph")
    expect(executeRalph).toBeTruthy()

    const output = await executeRalph.handler("--reviewer-model=sonnet", {})
    expect(output).toContain("/hyperpowers:execute-ralph [--reviewer-model=opus|sonnet]")
    expect(output).toContain("Final close requires BOTH: autonomous-reviewer APPROVED and review-implementation APPROVED")
    expect(output).toContain("Pi invocation arguments: --reviewer-model=sonnet")
  } finally {
    cleanup()
  }
})

test("brainstorm command can load its dedicated command wrapper after Pi install", async () => {
  const { commands, cleanup } = await installAndLoadCommands()
  try {
    const brainstorm = commands.get("brainstorm")
    expect(brainstorm).toBeTruthy()

    const output = await brainstorm.handler(undefined, {})
    expect(output).toContain("Use the hyperpowers:brainstorming skill exactly as written")
  } finally {
    cleanup()
  }
})
