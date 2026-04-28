import { spawnSync } from "node:child_process"
import { getTmBin } from "./tm-utils"

export interface TmTask {
  id: string
  title: string
  design?: string
  status: string
  priority: number
  issue_type: string
  owner?: string
  created_at?: string
  created_by?: string
  updated_at?: string
  dependency_count?: number
  dependent_count?: number
  comment_count?: number
}

export interface TmCommandResult<T> {
  ok: boolean
  data?: T
  error?: string
}

function runTmJson<T>(
  args: string[],
  cwd: string,
  timeoutMs = 30000,
): TmCommandResult<T> {
  const bin = getTmBin(cwd)

  const result = spawnSync(bin, [...args, "--json"], {
    encoding: "utf8",
    cwd,
    timeout: timeoutMs,
    env: { ...process.env },
  })

  if (result.error) {
    const message = (result.error as Error).message
    if (message.includes("ENOENT")) {
      return { ok: false, error: `tm binary not found: ${bin}` }
    }
    return { ok: false, error: `Error invoking tm: ${message}` }
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || ""
    const stdout = result.stdout?.trim() || ""
    return {
      ok: false,
      error: `tm exited with code ${result.status}: ${stderr || stdout || "unknown error"}`,
    }
  }

  const stdout = result.stdout?.trim() || ""
  if (!stdout) {
    const cmd = args[0]
    if (cmd === "ready" || cmd === "list") {
      return { ok: true, data: [] as unknown as T }
    }
    return { ok: true, data: undefined as unknown as T }
  }

  // Handle non-JSON prefix text (e.g. warnings) by finding the first line
  // whose first non-whitespace character is '[' or '{'.
  const lines = stdout.split("\n")
  let jsonStartLine = -1
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart()
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      jsonStartLine = i
      break
    }
  }
  const jsonText = jsonStartLine >= 0 ? lines.slice(jsonStartLine).join("\n") : stdout

  try {
    const parsed = JSON.parse(jsonText)
    return { ok: true, data: parsed as T }
  } catch (parseErr) {
    // Text-mode fallback for backends that don't support --json (e.g. linear)
    const cmd = args[0]
    const nonEmptyLines = lines.filter(l => l.trim() !== "")

    if (cmd === "ready" || cmd === "list") {
      let statusValue = cmd === "ready" ? "ready" : "open"
      const statusIdx = args.indexOf("--status")
      if (statusIdx >= 0 && statusIdx + 1 < args.length) {
        statusValue = args[statusIdx + 1]!
      }

      const tasks: TmTask[] = nonEmptyLines.map(line => {
        const match = line.match(/^(\S+)\s+(.+)$/)
        return {
          id: match ? match[1]! : "unknown",
          title: match ? match[2]! : line,
          status: statusValue,
          priority: 2,
          issue_type: "task"
        }
      })
      return { ok: true, data: tasks as unknown as T }
    } else if (cmd === "show") {
      const idMatch = lines[0]?.match(/^(\S+):\s+(.+)$/)
      if (!idMatch) {
        return { ok: false, error: `Task not found or invalid format: ${stdout}` }
      }
      
      const statusMatch = lines.find(l => l.startsWith("Status:"))?.match(/^Status:\s+(.+)$/)
      
      const designStart = lines.findIndex(l => l.trim() === "")
      const design = designStart >= 0 ? lines.slice(designStart + 1).join("\n") : ""
      
      const task: TmTask = {
        id: idMatch[1]!,
        title: idMatch[2]!,
        status: statusMatch ? statusMatch[1]! : "open",
        priority: 2,
        issue_type: "task",
        design
      }
      return { ok: true, data: [task] as unknown as T }
    }

    // For update / close, return the raw stdout as a message object
    return { ok: true, data: { message: stdout } as unknown as T }
  }
}

/**
 * Fetch ready (unblocked) tasks from tm.
 */
export function getReadyTasks(cwd?: string): TmCommandResult<TmTask[]> {
  return runTmJson<TmTask[]>(["ready"], cwd || process.cwd())
}

/**
 * Fetch assigned / in-progress tasks from tm.
 */
export function getOpenTasks(cwd?: string): TmCommandResult<TmTask[]> {
  return runTmJson<TmTask[]>(["list", "--status", "open"], cwd || process.cwd())
}

/**
 * Fetch blocked tasks from tm.
 */
export function getBlockedTasks(cwd?: string): TmCommandResult<TmTask[]> {
  return runTmJson<TmTask[]>(["list", "--status", "blocked"], cwd || process.cwd())
}

/**
 * Fetch assigned / in-progress tasks from tm.
 */
export function getAssignedTasks(cwd?: string): TmCommandResult<TmTask[]> {
  return runTmJson<TmTask[]>(["list", "--status", "in_progress"], cwd || process.cwd())
}

/**
 * Fetch closed / done tasks from tm.
 */
export function getClosedTasks(cwd?: string): TmCommandResult<TmTask[]> {
  return runTmJson<TmTask[]>(["list", "--status", "closed"], cwd || process.cwd())
}

/**
 * Show details for a specific task.
 */
export function showTask(
  id: string,
  cwd?: string,
): TmCommandResult<TmTask> {
  const result = runTmJson<TmTask | TmTask[]>(["show", id], cwd || process.cwd())
  if (!result.ok) return { ok: false, error: result.error }
  
  const data = result.data
  if (!data) {
    return { ok: false, error: `Task ${id} not found` }
  }
  
  const task = Array.isArray(data) ? data[0] : data
  if (!task) {
    return { ok: false, error: `Task ${id} not found` }
  }
  
  return { ok: true, data: task as TmTask }
}

/**
 * Update a task's status or priority.
 */
export function updateTask(
  id: string,
  updates: { status?: string; priority?: number; assignee?: string },
  cwd?: string,
): TmCommandResult<{ message: string }> {
  const args = ["update", id]
  if (updates.status) args.push("--status", updates.status)
  if (updates.priority !== undefined) args.push("--priority", String(updates.priority))
  if (updates.assignee) args.push("--assignee", updates.assignee)

  return runTmJson<{ message: string }>(args, cwd || process.cwd())
}

/**
 * Claim a task (set status to in_progress).
 * Uses portable `--status in_progress` instead of backend-specific `--claim`
 * so it works across bd, br, tk, and linear backends.
 */
export function claimTask(
  id: string,
  cwd?: string,
): TmCommandResult<{ message: string }> {
  return updateTask(id, { status: "in_progress" }, cwd)
}

/**
 * Close a task.
 */
export function closeTask(
  id: string,
  cwd?: string,
): TmCommandResult<{ message: string }> {
  return runTmJson<{ message: string }>(["close", id], cwd || process.cwd())
}
