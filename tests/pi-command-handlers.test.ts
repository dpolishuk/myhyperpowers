import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { test, expect } from "bun:test"

const repoRoot = path.resolve(__dirname, "..")

function createFakePiShim(binDir: string): void {
  const piPath = path.join(binDir, "pi")
  writeFileSync(piPath, "#!/bin/sh\nif [ -n \"$HYPERPOWERS_PI_TEST_CAPTURE\" ]; then\n  printf '%s\\n' \"$@\" > \"$HYPERPOWERS_PI_TEST_CAPTURE\"\nfi\nprintf 'PI_SHIM_OK\\n'\n", "utf8")
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
    home,
    binDir,
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

test("routing-settings returns informational fallback when Pi UI context is unavailable", async () => {
  const { commands, cleanup } = await installAndLoadCommands()
  try {
    const routingSettings = commands.get("routing-settings")
    const configureRouting = commands.get("configure-routing")
    expect(routingSettings).toBeTruthy()
    expect(configureRouting).toBeTruthy()

    const routingOutput = await routingSettings.handler(undefined, {})
    const aliasOutput = await configureRouting.handler(undefined, {})
    expect(routingOutput).toContain("interactive routing wizard requires Pi's TUI UI context")
    expect(routingOutput).toContain("routing.json")
    expect(aliasOutput).toContain("interactive routing wizard requires Pi's TUI UI context")
  } finally {
    cleanup()
  }
})

test("command handler applies advisory Pi subprocess metadata when enabled", async () => {
  const { commands, home, binDir, cleanup } = await installAndLoadCommands()
  const capturePath = path.join(home, "pi-args.txt")
  const skillPath = path.join(home, ".pi", "agent", "extensions", "hyperpowers", "skills", "brainstorming", "SKILL.md")
  const originalSkill = readFileSync(skillPath, "utf8")
  const originalPath = process.env.PATH

  try {
    writeFileSync(skillPath, `---\nname: brainstorming\ndescription: test metadata\nmetadata:\n  pi:\n    subProcess: true\n    model: openai/gpt-4.1-mini\n    thinkingLevel: high\n---\n\n${originalSkill.replace(/^---\n[\s\S]*?\n---\n?/, "")}`, "utf8")

    process.env.HYPERPOWERS_PI_TEST_CAPTURE = capturePath
    process.env.PATH = `${binDir}:${originalPath}`
    const brainstorm = commands.get("brainstorm")
    expect(brainstorm).toBeTruthy()

    const output = await brainstorm.handler("--foo=bar", { cwd: repoRoot })
    const capturedArgs = readFileSync(capturePath, "utf8")

    expect(output).toContain("PI_SHIM_OK")
    expect(capturedArgs).toContain("--no-session")
    expect(capturedArgs).toContain("--model")
    expect(capturedArgs).toContain("openai/gpt-4.1-mini")
    expect(capturedArgs).toContain("--thinking")
    expect(capturedArgs).toContain("high")
  } finally {
    delete process.env.HYPERPOWERS_PI_TEST_CAPTURE
    process.env.PATH = originalPath
    writeFileSync(skillPath, originalSkill, "utf8")
    cleanup()
  }
})

test("command handler keeps routing authoritative over advisory metadata model and thinking", async () => {
  const { commands, home, binDir, cleanup } = await installAndLoadCommands()
  const capturePath = path.join(home, "pi-args.txt")
  const skillPath = path.join(home, ".pi", "agent", "extensions", "hyperpowers", "skills", "brainstorming", "SKILL.md")
  const routingPath = path.join(home, ".pi", "agent", "extensions", "hyperpowers", "routing.json")
  const originalSkill = readFileSync(skillPath, "utf8")
  const originalRouting = readFileSync(routingPath, "utf8")
  const originalPath = process.env.PATH

  try {
    writeFileSync(skillPath, `---\nname: brainstorming\ndescription: test metadata\nmetadata:\n  pi:\n    subProcess: true\n    model: openai/gpt-4.1-mini\n    thinkingLevel: high\n---\n\n${originalSkill.replace(/^---\n[\s\S]*?\n---\n?/, "")}`, "utf8")
    writeFileSync(routingPath, JSON.stringify({ subagents: { default: { model: "anthropic/claude-haiku-4-5", effort: "low" } } }, null, 2))

    process.env.HYPERPOWERS_PI_TEST_CAPTURE = capturePath
    process.env.PATH = `${binDir}:${originalPath}`
    const brainstorm = commands.get("brainstorm")
    const output = await brainstorm.handler(undefined, { cwd: repoRoot })
    const capturedArgs = readFileSync(capturePath, "utf8")

    expect(output).toContain("PI_SHIM_OK")
    expect(capturedArgs).toContain("anthropic/claude-haiku-4-5")
    expect(capturedArgs).not.toContain("openai/gpt-4.1-mini")
    expect(capturedArgs).toContain("low")
    expect(capturedArgs).not.toContain("high")
  } finally {
    delete process.env.HYPERPOWERS_PI_TEST_CAPTURE
    process.env.PATH = originalPath
    writeFileSync(skillPath, originalSkill, "utf8")
    writeFileSync(routingPath, originalRouting, "utf8")
    cleanup()
  }
})

test("command wrapper substitutes $ARGUMENTS with user-provided args", async () => {
  const { commands, cleanup } = await installAndLoadCommands()
  try {
    const brainstorm = commands.get("brainstorm")
    expect(brainstorm).toBeTruthy()

    const output = await brainstorm.handler("user authentication flow", {})
    expect(output).toContain("Topic: user authentication flow")
    expect(output).not.toContain("$ARGUMENTS")
    expect(output).toContain("Pi invocation arguments: user authentication flow")
  } finally {
    cleanup()
  }
})

test("command handler honors advisory fork subprocess context when session file is available", async () => {
  const { commands, home, binDir, cleanup } = await installAndLoadCommands()
  const capturePath = path.join(home, "pi-args.txt")
  const skillPath = path.join(home, ".pi", "agent", "extensions", "hyperpowers", "skills", "brainstorming", "SKILL.md")
  const sessionFile = path.join(home, "parent-session.jsonl")
  const originalSkill = readFileSync(skillPath, "utf8")
  const originalPath = process.env.PATH

  try {
    writeFileSync(skillPath, `---\nname: brainstorming\ndescription: test metadata\nmetadata:\n  pi:\n    subProcess: true\n    subProcessContext: fork\n---\n\n${originalSkill.replace(/^---\n[\s\S]*?\n---\n?/, "")}`, "utf8")
    writeFileSync(sessionFile, '{"role":"user","content":[{"type":"text","text":"hello"}]}\n', "utf8")

    process.env.HYPERPOWERS_PI_TEST_CAPTURE = capturePath
    process.env.PATH = `${binDir}:${originalPath}`
    const brainstorm = commands.get("brainstorm")
    const output = await brainstorm.handler(undefined, {
      cwd: repoRoot,
      sessionManager: {
        getSessionFile: () => sessionFile,
      },
    })
    const capturedArgs = readFileSync(capturePath, "utf8")

    expect(output).toContain("PI_SHIM_OK")
    expect(capturedArgs).toContain("--session")
    expect(capturedArgs).toContain("--session-dir")
    expect(capturedArgs).not.toContain("--no-session")
  } finally {
    delete process.env.HYPERPOWERS_PI_TEST_CAPTURE
    process.env.PATH = originalPath
    writeFileSync(skillPath, originalSkill, "utf8")
    cleanup()
  }
})

test("command handler preserves routing inherit and ignores advisory metadata model", async () => {
  const { commands, home, binDir, cleanup } = await installAndLoadCommands()
  const capturePath = path.join(home, "pi-args.txt")
  const skillPath = path.join(home, ".pi", "agent", "extensions", "hyperpowers", "skills", "brainstorming", "SKILL.md")
  const routingPath = path.join(home, ".pi", "agent", "extensions", "hyperpowers", "routing.json")
  const originalSkill = readFileSync(skillPath, "utf8")
  const originalRouting = readFileSync(routingPath, "utf8")
  const originalPath = process.env.PATH

  try {
    // Skill wants gpt-4.1-mini but routing is inherit (default empty config)
    writeFileSync(skillPath, `---\nname: brainstorming\ndescription: test metadata\nmetadata:\n  pi:\n    subProcess: true\n    model: openai/gpt-4.1-mini\n    thinkingLevel: high\n---\n\n${originalSkill.replace(/^---\n[\s\S]*?\n---\n?/, "")}`, "utf8")
    // Default routing config with inherit (no model/effort set)
    writeFileSync(routingPath, JSON.stringify({ subagents: { default: { model: "inherit" } } }, null, 2))

    process.env.HYPERPOWERS_PI_TEST_CAPTURE = capturePath
    process.env.PATH = `${binDir}:${originalPath}`
    const brainstorm = commands.get("brainstorm")
    const output = await brainstorm.handler(undefined, { cwd: repoRoot })
    const capturedArgs = readFileSync(capturePath, "utf8")

    expect(output).toContain("PI_SHIM_OK")
    // When routing is inherit, metadata model should be used as fallback
    expect(capturedArgs).toContain("openai/gpt-4.1-mini")
  } finally {
    delete process.env.HYPERPOWERS_PI_TEST_CAPTURE
    process.env.PATH = originalPath
    writeFileSync(skillPath, originalSkill, "utf8")
    writeFileSync(routingPath, originalRouting, "utf8")
    cleanup()
  }
})

test("command handler falls back to fresh context when fork is requested but no session file", async () => {
  const { commands, home, binDir, cleanup } = await installAndLoadCommands()
  const capturePath = path.join(home, "pi-args.txt")
  const skillPath = path.join(home, ".pi", "agent", "extensions", "hyperpowers", "skills", "brainstorming", "SKILL.md")
  const originalSkill = readFileSync(skillPath, "utf8")
  const originalPath = process.env.PATH

  try {
    writeFileSync(skillPath, `---\nname: brainstorming\ndescription: test metadata\nmetadata:\n  pi:\n    subProcess: true\n    subProcessContext: fork\n---\n\n${originalSkill.replace(/^---\n[\s\S]*?\n---\n?/, "")}`, "utf8")

    process.env.HYPERPOWERS_PI_TEST_CAPTURE = capturePath
    process.env.PATH = `${binDir}:${originalPath}`
    const brainstorm = commands.get("brainstorm")
    // No sessionManager provided — fork should gracefully fall back to fresh
    const output = await brainstorm.handler(undefined, { cwd: repoRoot })
    const capturedArgs = readFileSync(capturePath, "utf8")

    expect(output).toContain("PI_SHIM_OK")
    // Should use fresh context (--no-session) since no session file is available
    expect(capturedArgs).toContain("--no-session")
    expect(capturedArgs).not.toContain("--session-dir")
  } finally {
    delete process.env.HYPERPOWERS_PI_TEST_CAPTURE
    process.env.PATH = originalPath
    writeFileSync(skillPath, originalSkill, "utf8")
    cleanup()
  }
})
