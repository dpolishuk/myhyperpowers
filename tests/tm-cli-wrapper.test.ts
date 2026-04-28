import { test, expect, mock, beforeEach } from "bun:test"
import {
  getReadyTasks,
  getAssignedTasks,
  showTask,
  updateTask,
  claimTask,
  closeTask,
  type TmTask,
} from "../.pi/extensions/hyperpowers/tm-cli-wrapper"

const mockSpawnSync = mock(() => ({
  status: 0,
  stdout: "",
  stderr: "",
  error: undefined as any,
  signal: null,
}))

mock.module("node:child_process", () => ({
  spawnSync: mockSpawnSync,
  spawn: () => { throw new Error("not mocked") },
}))

beforeEach(() => {
  mockSpawnSync.mockClear()
})

test("getReadyTasks parses valid JSON array", () => {
  const tasks: TmTask[] = [
    {
      id: "bd-1",
      title: "Fix auth bug",
      status: "open",
      priority: 0,
      issue_type: "bug",
    },
  ]

  mockSpawnSync.mockImplementation(() => ({
    status: 0,
    stdout: JSON.stringify(tasks),
    stderr: "",
    error: undefined,
    signal: null,
  }))

  const result = getReadyTasks("/tmp/project")
  expect(result.ok).toBe(true)
  expect(result.data).toHaveLength(1)
  expect(result.data![0].id).toBe("bd-1")
  expect(result.data![0].title).toBe("Fix auth bug")
})

test("getReadyTasks strips non-JSON prefix warnings", () => {
  const tasks: TmTask[] = [
    {
      id: "bd-2",
      title: "Add tests",
      status: "open",
      priority: 1,
      issue_type: "task",
    },
  ]

  mockSpawnSync.mockImplementation(() => ({
    status: 0,
    stdout: `tm-sync: Warning: corrupted mapping\n${JSON.stringify(tasks)}`,
    stderr: "",
    error: undefined,
    signal: null,
  }))

  const result = getReadyTasks("/tmp/project")
  expect(result.ok).toBe(true)
  expect(result.data).toHaveLength(1)
  expect(result.data![0].id).toBe("bd-2")
})

test("getReadyTasks handles bracket inside warning prefix", () => {
  const tasks: TmTask[] = [
    {
      id: "bd-2b",
      title: "Bracket test",
      status: "open",
      priority: 1,
      issue_type: "task",
    },
  ]

  mockSpawnSync.mockImplementation(() => ({
    status: 0,
    stdout: `tm-sync: [WARN] corrupted mapping\n${JSON.stringify(tasks)}`,
    stderr: "",
    error: undefined,
    signal: null,
  }))

  const result = getReadyTasks("/tmp/project")
  expect(result.ok).toBe(true)
  expect(result.data).toHaveLength(1)
  expect(result.data![0].id).toBe("bd-2b")
})

test("getReadyTasks returns error when tm binary is missing", () => {
  mockSpawnSync.mockImplementation(() => ({
    status: null,
    stdout: "",
    stderr: "",
    error: new Error("spawnSync tm ENOENT"),
    signal: null,
  }))

  const result = getReadyTasks("/tmp/project")
  expect(result.ok).toBe(false)
  expect(result.error).toContain("tm binary not found")
})

test("getReadyTasks returns error on non-zero exit", () => {
  mockSpawnSync.mockImplementation(() => ({
    status: 1,
    stdout: "",
    stderr: "bad config",
    error: undefined,
    signal: null,
  }))

  const result = getReadyTasks("/tmp/project")
  expect(result.ok).toBe(false)
  expect(result.error).toContain("tm exited with code 1")
  expect(result.error).toContain("bad config")
})

test("getReadyTasks returns text fallback on invalid JSON", () => {
  mockSpawnSync.mockImplementation(() => ({
    status: 0,
    stdout: "ENG-123 Some Task",
    stderr: "",
    error: undefined,
    signal: null,
  }))

  const result = getReadyTasks("/tmp/project")
  expect(result.ok).toBe(true)
  expect((result.data as any)[0].id).toBe("ENG-123")
  expect((result.data as any)[0].title).toBe("Some Task")
})

test("showTask returns single task from JSON array", () => {
  const task: TmTask = {
    id: "bd-3",
    title: "Epic: OAuth",
    status: "open",
    priority: 0,
    issue_type: "epic",
    design: "## Requirements\n- OAuth login",
  }

  mockSpawnSync.mockImplementation(() => ({
    status: 0,
    stdout: JSON.stringify([task]),
    stderr: "",
    error: undefined,
    signal: null,
  }))

  const result = showTask("bd-3", "/tmp/project")
  expect(result.ok).toBe(true)
  expect(result.data!.id).toBe("bd-3")
  expect(result.data!.title).toBe("Epic: OAuth")
})

test("showTask returns error when task not found", () => {
  mockSpawnSync.mockImplementation(() => ({
    status: 0,
    stdout: "[]",
    stderr: "",
    error: undefined,
    signal: null,
  }))

  const result = showTask("bd-99", "/tmp/project")
  expect(result.ok).toBe(false)
  expect(result.error).toContain("not found")
})

test("updateTask passes correct arguments", () => {
  mockSpawnSync.mockImplementation(() => ({
    status: 0,
    stdout: JSON.stringify({ message: "updated" }),
    stderr: "",
    error: undefined,
    signal: null,
  }))

  const result = updateTask("bd-4", { status: "in_progress", priority: 1 }, "/tmp/project")
  expect(result.ok).toBe(true)

  const [, args] = mockSpawnSync.mock.calls[0]!
  expect(args).toContain("update")
  expect(args).toContain("bd-4")
  expect(args).toContain("--status")
  expect(args).toContain("in_progress")
  expect(args).toContain("--priority")
  expect(args).toContain("1")
  expect(args).toContain("--json")
})

test("claimTask uses portable --status in_progress", () => {
  mockSpawnSync.mockImplementation(() => ({
    status: 0,
    stdout: JSON.stringify({ message: "claimed" }),
    stderr: "",
    error: undefined,
    signal: null,
  }))

  const result = claimTask("bd-5", "/tmp/project")
  expect(result.ok).toBe(true)

  const [, args] = mockSpawnSync.mock.calls[0]!
  expect(args).toContain("update")
  expect(args).toContain("bd-5")
  expect(args).toContain("--status")
  expect(args).toContain("in_progress")
  expect(args).toContain("--json")
  expect(args).not.toContain("--claim")
})

test("closeTask passes correct arguments", () => {
  mockSpawnSync.mockImplementation(() => ({
    status: 0,
    stdout: JSON.stringify({ message: "closed" }),
    stderr: "",
    error: undefined,
    signal: null,
  }))

  const result = closeTask("bd-6", "/tmp/project")
  expect(result.ok).toBe(true)

  const [, args] = mockSpawnSync.mock.calls[0]!
  expect(args).toContain("close")
  expect(args).toContain("bd-6")
  expect(args).toContain("--json")
})

test("getAssignedTasks calls list --status in_progress", () => {
  const tasks: TmTask[] = [
    {
      id: "bd-7",
      title: "In-progress task",
      status: "in_progress",
      priority: 2,
      issue_type: "feature",
    },
  ]

  mockSpawnSync.mockImplementation(() => ({
    status: 0,
    stdout: JSON.stringify(tasks),
    stderr: "",
    error: undefined,
    signal: null,
  }))

  const result = getAssignedTasks("/tmp/project")
  expect(result.ok).toBe(true)
  expect(result.data![0].status).toBe("in_progress")

  const [, args] = mockSpawnSync.mock.calls[0]!
  expect(args).toContain("list")
  expect(args).toContain("--status")
  expect(args).toContain("in_progress")
})
