import { test, expect, mock } from "bun:test"
import { EventEmitter } from "node:events"
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  MAX_ASYNC_SUBAGENT_OUTPUT_BYTES,
  buildPiTaskArgs,
  executePiTask,
  executePiTaskAsync,
  executePiTasksChain,
  executePiTasksParallel,
  type SpawnAsyncLike,
} from "../.pi/extensions/hyperpowers/task-runner"

test("buildPiTaskArgs uses no-session for fresh context", () => {
  expect(buildPiTaskArgs("Investigate auth", null, undefined, "fresh")).toEqual([
    "--print",
    "--no-session",
    "Investigate auth",
  ])
})

test("executePiTask uses fork context session seed when requested", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "pi-task-runner-test-"))
  const sessionSeedPath = join(tempDir, "parent-session.jsonl")
  writeFileSync(sessionSeedPath, '{"role":"user","content":[{"type":"text","text":"hello"}]}\n', "utf8")

  const run = mock(() => ({
    status: 0,
    stdout: "ok",
    stderr: "",
  }))

  try {
    const result = executePiTask({
      task: "Review code",
      cwd: "/tmp/project",
      contextMode: "fork",
      sessionSeedPath,
    }, run as any)

    expect(result.content[0].text).toBe("ok")
    const [, args] = run.mock.calls[0]!
    expect(args).toContain("--session")
    expect(args).toContain("--session-dir")
    expect(args).not.toContain("--no-session")
    const sessionArgIndex = args.indexOf("--session")
    const sessionDirIndex = args.indexOf("--session-dir")
    expect(sessionArgIndex).toBeGreaterThan(-1)
    expect(sessionDirIndex).toBeGreaterThan(-1)
    expect(existsSync(args[sessionArgIndex + 1])).toBe(false)
    expect(existsSync(args[sessionDirIndex + 1])).toBe(false)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("executePiTask returns normalized failure when fork session seed is unreadable", () => {
  const result = executePiTask({
    task: "Review code",
    cwd: "/tmp/project",
    contextMode: "fork",
    sessionSeedPath: "/tmp/does-not-exist/session.jsonl",
    format: "structured",
  })

  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("fork context unavailable")
  expect(parsed.findings[0]).toMatchObject({ type: "missing-session", source: "pi-subagent" })
})

test("executePiTaskAsync returns normalized failure when fork session seed is unreadable", async () => {
  const result = await executePiTaskAsync({
    task: "Review code",
    cwd: "/tmp/project",
    contextMode: "fork",
    sessionSeedPath: "/tmp/does-not-exist/session.jsonl",
    format: "structured",
  })

  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("fork context unavailable")
  expect(parsed.findings[0]).toMatchObject({ type: "missing-session", source: "pi-subagent" })
})

test("executePiTaskAsync short-circuits before spawn when already aborted", async () => {
  const controller = new AbortController()
  controller.abort()
  const run: SpawnAsyncLike = mock(() => {
    throw new Error("should not spawn")
  }) as any

  const result = await executePiTaskAsync({
    task: "Review code",
    cwd: "/tmp/project",
    format: "structured",
  }, run, controller.signal)

  expect(run).toHaveBeenCalledTimes(0)
  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("cancelled")
})

test("executePiTaskAsync ignores additional output after output-limit termination begins", async () => {
  const child = new EventEmitter() as any
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdout.setEncoding = () => {}
  child.stderr.setEncoding = () => {}
  child.kill = mock(() => true)

  const run: SpawnAsyncLike = mock(() => child) as any
  const promise = executePiTaskAsync({
    task: "Review code",
    cwd: "/tmp/project",
    format: "structured",
  }, run)

  child.stdout.emit("data", "x".repeat(MAX_ASYNC_SUBAGENT_OUTPUT_BYTES + 1))
  child.stdout.emit("data", "y".repeat(1024))
  child.stderr.emit("data", "z".repeat(MAX_ASYNC_SUBAGENT_OUTPUT_BYTES + 1))
  child.emit("close", null, "SIGTERM")

  const result = await promise
  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("output exceeded max buffer")
  expect(parsed.findings[0]).toMatchObject({
    message: `stdout exceeded ${MAX_ASYNC_SUBAGENT_OUTPUT_BYTES} bytes`,
    type: "output-limit",
    source: "pi-subagent",
  })
  expect(child.kill).toHaveBeenCalledTimes(1)
  expect(child.kill).toHaveBeenCalledWith("SIGTERM")
})

test("executePiTasksParallel preserves input order even when completion order differs", async () => {
  const results = await executePiTasksParallel(["slow", "fast", "mid"], async (task) => {
    const delay = task === "slow" ? 20 : task === "mid" ? 10 : 0
    await new Promise((resolve) => setTimeout(resolve, delay))
    return `${task}-done`
  }, { maxConcurrency: 3 })

  expect(results).toEqual(["slow-done", "fast-done", "mid-done"])
})

test("executePiTasksParallel respects maxConcurrency", async () => {
  let active = 0
  let peak = 0

  const results = await executePiTasksParallel([1, 2, 3, 4], async (value) => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
    return value * 2
  }, { maxConcurrency: 2 })

  expect(results).toEqual([2, 4, 6, 8])
  expect(peak).toBe(2)
})

test("executePiTasksChain passes previous results sequentially", async () => {
  const results = await executePiTasksChain(["find", "summarize", "finalize"], async (task, previousResults) => {
    if (task === "find") return "auth-flow"
    if (task === "summarize") return `summary:${previousResults.at(-1)}`
    return `final:${previousResults.join("|")}`
  })

  expect(results).toEqual([
    "auth-flow",
    "summary:auth-flow",
    "final:auth-flow|summary:auth-flow",
  ])
})

test("executePiTasksChain stops on first failure", async () => {
  const calls: string[] = []

  await expect(executePiTasksChain(["first", "boom", "never"], async (task) => {
    calls.push(task)
    if (task === "boom") {
      throw new Error("chain failed")
    }
    return `${task}-ok`
  })).rejects.toThrow("chain failed")

  expect(calls).toEqual(["first", "boom"])
})

test("executePiTasksChain forwards abort signal to each step", async () => {
  const controller = new AbortController()
  const seenSignals: AbortSignal[] = []

  await executePiTasksChain(["one", "two"], async (_task, _previousResults, signal) => {
    seenSignals.push(signal!)
    if (seenSignals.length === 1) {
      controller.abort()
    }
    return "ok"
  }, { signal: controller.signal })

  // Only the first step runs; the chain short-circuits before step 2
  expect(seenSignals).toHaveLength(1)
  expect(seenSignals[0]).toBe(controller.signal)
})

test("executePiTasksParallel stops dequeuing after abort", async () => {
  const controller = new AbortController()
  controller.abort()
  const calls: string[] = []

  const results = await executePiTasksParallel(["a", "b", "c"], async (task) => {
    calls.push(task)
    return `${task}-done`
  }, { signal: controller.signal, maxConcurrency: 2 })

  expect(calls).toEqual([])
  expect(results).toEqual([undefined, undefined, undefined])
})

test("executePiTasksChain short-circuits on pre-aborted signal", async () => {
  const controller = new AbortController()
  controller.abort()
  const calls: string[] = []

  const results = await executePiTasksChain(["first", "second", "third"], async (task) => {
    calls.push(task)
    return `${task}-done`
  }, { signal: controller.signal })

  expect(calls).toEqual([])
  expect(results).toEqual([])
})
