import { test, expect, mock } from "bun:test"

import {
  buildPiSubagentArgs,
  buildStructuredSubagentTask,
  executePiSubagent,
  parseStructuredSubagentOutput,
} from "../.pi/extensions/hyperpowers/subagent"

test("buildPiSubagentArgs includes explicit model override", () => {
  expect(buildPiSubagentArgs("Review src/auth.ts", "openai/gpt-4.1")).toEqual([
    "--print",
    "--model",
    "openai/gpt-4.1",
    "--",
    "Review src/auth.ts",
  ])
})

test("buildPiSubagentArgs omits model when routing resolves to inherit", () => {
  expect(buildPiSubagentArgs("Investigate auth flow", null)).toEqual([
    "--print",
    "--",
    "Investigate auth flow",
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
  expect(args).toEqual(["--print", "--", "Review code"])
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
  expect(parsed.findings).toEqual([{ message: "boom" }])
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
  expect(parsed.findings).toEqual([{ message: "definitely not json" }])
})
