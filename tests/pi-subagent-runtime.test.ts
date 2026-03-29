import { test, expect, mock } from "bun:test"

import { buildPiSubagentArgs, executePiSubagent } from "../.pi/extensions/hyperpowers/subagent"

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
