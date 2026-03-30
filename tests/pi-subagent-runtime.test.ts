import { test, expect, mock } from "bun:test"
import { EventEmitter } from "node:events"

import {
  HYPERPOWERS_SUBAGENT_DEPTH_ENV,
  MAX_ASYNC_SUBAGENT_OUTPUT_BYTES,
  buildPiSubagentArgs,
  buildStructuredSubagentTask,
  executePiSubagent,
  executePiSubagentAsync,
  parseStructuredSubagentOutput,
} from "../.pi/extensions/hyperpowers/subagent"

test("buildPiSubagentArgs includes no-session by default", () => {
  expect(buildPiSubagentArgs("Investigate auth flow", null)).toEqual([
    "--print",
    "--no-session",
    "--",
    "Investigate auth flow",
  ])
})

test("buildPiSubagentArgs includes explicit model and thinking override", () => {
  expect(buildPiSubagentArgs("Review src/auth.ts", "openai/gpt-4.1", "high")).toEqual([
    "--print",
    "--no-session",
    "--model",
    "openai/gpt-4.1",
    "--thinking",
    "high",
    "--",
    "Review src/auth.ts",
  ])
})

test("buildPiSubagentArgs omits thinking when not provided", () => {
  expect(buildPiSubagentArgs("Review src/auth.ts", "openai/gpt-4.1")).toEqual([
    "--print",
    "--no-session",
    "--model",
    "openai/gpt-4.1",
    "--",
    "Review src/auth.ts",
  ])
})

test("executePiSubagent prefers ctx cwd over process cwd", () => {
  const run = mock(() => ({
    status: 0,
    stdout: "ok",
    stderr: "",
  }))

  const result = executePiSubagent(
    {
      task: "Review code",
      cwd: "/tmp/project",
    },
    run as any,
  )

  expect(run).toHaveBeenCalledTimes(1)
  const [cmd, args, options] = run.mock.calls[0]!
  expect(cmd).toBe("pi")
  expect(args).toEqual(["--print", "--no-session", "--", "Review code"])
  expect(options.cwd).toBe("/tmp/project")
  expect(result.content[0].text).toBe("ok")
})

test("executePiSubagent falls back to process cwd when ctx cwd missing", () => {
  const run = mock(() => ({
    status: 0,
    stdout: "ok",
    stderr: "",
  }))

  executePiSubagent(
    {
      task: "Review code",
    },
    run as any,
  )

  const [, , options] = run.mock.calls[0]!
  expect(options.cwd).toBe(process.cwd())
})

test("executePiSubagent passes thinking level when requested", () => {
  const run = mock(() => ({
    status: 0,
    stdout: "ok",
    stderr: "",
  }))

  executePiSubagent(
    {
      task: "Run tests",
      cwd: "/tmp/project",
      effort: "medium",
    },
    run as any,
  )

  const [, args] = run.mock.calls[0]!
  expect(args).toEqual(["--print", "--no-session", "--thinking", "medium", "--", "Run tests"])
})

test("executePiSubagent returns stderr on subprocess failure", () => {
  const result = executePiSubagent(
    {
      task: "Run tests",
      cwd: "/tmp/project",
    },
    mock(() => ({
      status: 2,
      stdout: "",
      stderr: "boom",
    })) as any,
  )

  expect(result.content[0].text).toContain("Subagent failed")
  expect(result.content[0].text).toContain("exit 2")
  expect(result.content[0].text).toContain("boom")
})

test("executePiSubagent returns JSON-shaped errors on subprocess failure in structured mode", () => {
  const result = executePiSubagent(
    {
      task: "Run tests",
      cwd: "/tmp/project",
      format: "structured",
    },
    mock(() => ({
      status: 2,
      stdout: "",
      stderr: "boom",
    })) as any,
  )

  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("exit 2")
  expect(parsed.findings).toEqual([{
    message: "boom",
    type: "subprocess-error",
    source: "pi-subagent",
  }])
})

test("executePiSubagent falls back to stdout when stderr is empty on failure", () => {
  const result = executePiSubagent(
    {
      task: "Review code",
      cwd: "/tmp/project",
    },
    mock(() => ({
      status: 1,
      stdout: "failed in stdout",
      stderr: "",
    })) as any,
  )

  expect(result.content[0].text).toContain("failed in stdout")
})

test("executePiSubagent reports signal and error details when no exit status is available", () => {
  const result = executePiSubagent(
    {
      task: "Review code",
      cwd: "/tmp/project",
    },
    mock(() => ({
      status: null,
      stdout: "",
      stderr: "",
      signal: "SIGTERM",
      error: new Error("spawn pi ENOENT"),
    })) as any,
  )

  expect(result.content[0].text).toContain("no exit status")
  expect(result.content[0].text).toContain("SIGTERM")
  expect(result.content[0].text).toContain("spawn pi ENOENT")
})

test("executePiSubagent returns JSON-shaped no-exit-status errors in structured mode", () => {
  const result = executePiSubagent(
    {
      task: "Review code",
      cwd: "/tmp/project",
      format: "structured",
    },
    mock(() => ({
      status: null,
      stdout: "",
      stderr: "",
      signal: "SIGTERM",
      error: new Error("spawn pi ENOENT"),
    })) as any,
  )

  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("no exit status")
  expect(parsed.summary).toContain("SIGTERM")
  expect(parsed.summary).toContain("spawn pi ENOENT")
  expect(parsed.findings[0]).toMatchObject({
    message: "unknown error",
    type: "subprocess-error",
    source: "pi-subagent",
  })
})

test("buildStructuredSubagentTask wraps the task with JSON-only instructions", () => {
  const wrapped = buildStructuredSubagentTask("Review src/auth.ts")

  expect(wrapped).toContain("Return valid JSON only")
  expect(wrapped).toContain("Review src/auth.ts")
  expect(wrapped).toContain("status")
  expect(wrapped).toContain("findings")
})

test("parseStructuredSubagentOutput accepts valid JSON objects", () => {
  const parsed = parseStructuredSubagentOutput(JSON.stringify({
    status: "PASS",
    summary: "Looks good",
    findings: [],
    nextAction: "Ship it",
  }))

  expect(parsed.status).toBe("PASS")
  expect(parsed.summary).toBe("Looks good")
  expect(parsed.findings).toEqual([])
  expect(parsed.nextAction).toBe("Ship it")
})

test("parseStructuredSubagentOutput rejects invalid JSON with readable error text", () => {
  expect(() => parseStructuredSubagentOutput("not json")).toThrow(/valid JSON/i)
})

test("parseStructuredSubagentOutput rejects unsupported status values", () => {
  expect(() => parseStructuredSubagentOutput(JSON.stringify({
    status: "OK",
    summary: "Looks good",
    findings: [],
  }))).toThrow(/one of PASS, ISSUES_FOUND, FAIL/i)
})

test("executePiSubagent returns parsed structured content when format is structured and JSON is valid", () => {
  const result = executePiSubagent(
    {
      task: "Review code",
      cwd: "/tmp/project",
      format: "structured",
    },
    mock((_cmd, args) => ({
      status: 0,
      stdout: JSON.stringify({
        status: "PASS",
        summary: "All good",
        findings: [],
      }),
      stderr: "",
    })) as any,
  )

  expect(result.content[0].text).toContain('"status":"PASS"')
})

test("executePiSubagent treats missing or malformed depth env as safe default and increments child env", () => {
  const originalDepth = process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV]
  process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV] = "not-a-number"

  const run = mock(() => ({
    status: 0,
    stdout: "ok",
    stderr: "",
  }))

  try {
    executePiSubagent(
      {
        task: "Review code",
        cwd: "/tmp/project",
      },
      run as any,
    )
  } finally {
    if (originalDepth === undefined) delete process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV]
    else process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV] = originalDepth
  }

  const [, , options] = run.mock.calls[0]!
  expect(options.env?.[HYPERPOWERS_SUBAGENT_DEPTH_ENV]).toBe("1")
})

test("executePiSubagent short-circuits on depth overflow", () => {
  const originalDepth = process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV]
  process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV] = "1"
  const run = mock(() => ({
    status: 0,
    stdout: "ok",
    stderr: "",
  }))

  try {
    const result = executePiSubagent(
      {
        task: "Review code",
        cwd: "/tmp/project",
      },
      run as any,
    )

    expect(run).toHaveBeenCalledTimes(0)
    expect(result.content[0].text).toContain("maximum subagent recursion depth")
  } finally {
    if (originalDepth === undefined) delete process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV]
    else process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV] = originalDepth
  }
})

test("executePiSubagent returns structured FAIL payload on depth overflow", () => {
  const originalDepth = process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV]
  process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV] = "1"
  const run = mock(() => ({
    status: 0,
    stdout: "ok",
    stderr: "",
  }))

  try {
    const result = executePiSubagent(
      {
        task: "Review code",
        cwd: "/tmp/project",
        format: "structured",
      },
      run as any,
    )

    expect(run).toHaveBeenCalledTimes(0)
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.status).toBe("FAIL")
    expect(parsed.summary).toContain("maximum subagent recursion depth")
    expect(Array.isArray(parsed.findings)).toBe(true)
    expect(parsed.findings.length).toBeGreaterThan(0)
    expect(parsed.findings[0]).toMatchObject({
      type: "recursion-limit",
      source: "pi-subagent",
    })
  } finally {
    if (originalDepth === undefined) delete process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV]
    else process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV] = originalDepth
  }
})

function createMockAsyncChild() {
  const child = new EventEmitter() as any
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdout.setEncoding = () => {}
  child.stderr.setEncoding = () => {}
  child.kill = mock((signal?: string) => {
    queueMicrotask(() => child.emit("close", null, signal ?? "SIGTERM"))
    return true
  })
  return child
}

test("executePiSubagentAsync kills child and returns deterministic failure on abort", async () => {
  const originalDepth = process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV]
  delete process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV]
  const controller = new AbortController()
  const child = createMockAsyncChild()
  const spawnAsync = mock(() => child)

  const promise = executePiSubagentAsync(
    {
      task: "Review code",
      cwd: "/tmp/project",
    },
    spawnAsync as any,
    controller.signal,
  )

  controller.abort()
  const result = await promise

  expect(spawnAsync).toHaveBeenCalledTimes(1)
  expect(child.kill).toHaveBeenCalledWith("SIGTERM")
  expect(result.content[0].text).toContain("cancelled")

  if (originalDepth === undefined) delete process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV]
  else process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV] = originalDepth
})

test("executePiSubagentAsync short-circuits before spawn when already aborted", async () => {
  const controller = new AbortController()
  controller.abort()
  const spawnAsync = mock(() => createMockAsyncChild())

  const result = await executePiSubagentAsync(
    {
      task: "Review code",
      cwd: "/tmp/project",
      format: "structured",
    },
    spawnAsync as any,
    controller.signal,
  )

  expect(spawnAsync).toHaveBeenCalledTimes(0)
  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("cancelled")
  expect(parsed.findings[0]).toMatchObject({
    message: "Subagent cancelled by parent signal",
    type: "cancelled",
    source: "pi-subagent",
  })
})

test("executePiSubagentAsync keeps cancellation machine-readable in structured mode", async () => {
  const controller = new AbortController()
  const child = createMockAsyncChild()
  const spawnAsync = mock(() => child)

  const promise = executePiSubagentAsync(
    {
      task: "Review code",
      cwd: "/tmp/project",
      format: "structured",
    },
    spawnAsync as any,
    controller.signal,
  )

  controller.abort()
  const result = await promise
  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("cancelled")
  expect(parsed.findings[0]).toMatchObject({
    message: "Subagent cancelled by parent signal",
    type: "cancelled",
    source: "pi-subagent",
  })
})

test("executePiSubagentAsync caps stdout buffer growth and returns deterministic failure", async () => {
  const child = createMockAsyncChild()
  const spawnAsync = mock(() => child)

  const promise = executePiSubagentAsync(
    {
      task: "Review code",
      cwd: "/tmp/project",
      format: "structured",
    },
    spawnAsync as any,
  )

  child.stdout.emit("data", "x".repeat(MAX_ASYNC_SUBAGENT_OUTPUT_BYTES + 1))
  child.stdout.emit("data", "y".repeat(128))
  const result = await promise
  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("output exceeded max buffer")
  expect(parsed.findings[0]).toMatchObject({
    type: "output-limit",
    source: "pi-subagent",
  })
  expect(child.kill).toHaveBeenCalledWith("SIGTERM")
})

test("executePiSubagent returns a parsing failure when format is structured and JSON is invalid", () => {
  const result = executePiSubagent(
    {
      task: "Review code",
      cwd: "/tmp/project",
      format: "structured",
    },
    mock(() => ({
      status: 0,
      stdout: "definitely not json",
      stderr: "",
    })) as any,
  )

  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("Structured subagent output was not valid JSON")
  expect(parsed.findings).toEqual([{
    message: "definitely not json",
    type: "parse-error",
    source: "pi-subagent",
  }])
})
