import { spawnSync } from "node:child_process"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { Type } from "@sinclair/typebox"
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SOURCE_DIR, "..", "..", "..")
const TM_BIN = join(REPO_ROOT, "scripts", "tm")

function runTmCommand(args: string[], cwd: string): string {
  const result = spawnSync(TM_BIN, args, {
    encoding: "utf8",
    cwd,
    timeout: 30000,
    env: { ...process.env }
  })

  if (result.error) {
    throw result.error
  }
  
  if (result.status !== 0) {
    return `Error (exit ${result.status}):\n${result.stderr || result.stdout}`
  }

  return result.stdout || "Success (no output)"
}

export function registerTmTools(pi: ExtensionAPI) {
  // tm ready
  pi.registerTool({
    name: "tm_ready",
    label: "Task Manager: Ready",
    description: "List actionable tasks that are unblocked and ready to work on.",
    parameters: Type.Object({}),
    async execute(_toolCallId: string, _params: any, _signal?: unknown, _update?: unknown, ctx?: any) {
      const cwd = ctx?.cwd || process.cwd()
      return {
        content: [{ type: "text", text: runTmCommand(["ready"], cwd) }]
      }
    }
  })

  // tm show
  pi.registerTool({
    name: "tm_show",
    label: "Task Manager: Show",
    description: "Show detailed information about a specific task or epic.",
    parameters: Type.Object({
      id: Type.String({ description: "Task ID (e.g., bd-42)" })
    }),
    async execute(_toolCallId: string, params: { id: string }, _signal?: unknown, _update?: unknown, ctx?: any) {
      const cwd = ctx?.cwd || process.cwd()
      return {
        content: [{ type: "text", text: runTmCommand(["show", params.id], cwd) }]
      }
    }
  })

  // tm create
  pi.registerTool({
    name: "tm_create",
    label: "Task Manager: Create",
    description: "Create a new task, bug, feature, or epic.",
    parameters: Type.Object({
      title: Type.String({ description: "Short title for the task" }),
      type: Type.Optional(Type.String({ description: "task, feature, bug, or epic" })),
      priority: Type.Optional(Type.Number({ description: "0 (critical) to 4 (backlog)" })),
      design: Type.Optional(Type.String({ description: "Markdown body with requirements and context" }))
    }),
    async execute(_toolCallId: string, params: { title: string, type?: string, priority?: number, design?: string }, _signal?: unknown, _update?: unknown, ctx?: any) {
      const cwd = ctx?.cwd || process.cwd()
      const args = ["create", params.title]
      if (params.type) args.push("--type", params.type)
      if (params.priority !== undefined) args.push("--priority", params.priority.toString())
      if (params.design) args.push("--design", params.design)

      return {
        content: [{ type: "text", text: runTmCommand(args, cwd) }]
      }
    }
  })

  // tm update
  pi.registerTool({
    name: "tm_update",
    label: "Task Manager: Update",
    description: "Update the status, priority, or other metadata of an existing task.",
    parameters: Type.Object({
      id: Type.String({ description: "Task ID (e.g., bd-42)" }),
      status: Type.Optional(Type.String({ description: "todo, in_progress, done, blocked, archived" })),
      priority: Type.Optional(Type.Number({ description: "0 (critical) to 4 (backlog)" }))
    }),
    async execute(_toolCallId: string, params: { id: string, status?: string, priority?: number }, _signal?: unknown, _update?: unknown, ctx?: any) {
      const cwd = ctx?.cwd || process.cwd()
      const args = ["update", params.id]
      if (params.status) args.push("--status", params.status)
      if (params.priority !== undefined) args.push("--priority", params.priority.toString())

      return {
        content: [{ type: "text", text: runTmCommand(args, cwd) }]
      }
    }
  })

  // tm close
  pi.registerTool({
    name: "tm_close",
    label: "Task Manager: Close",
    description: "Mark a task as complete.",
    parameters: Type.Object({
      id: Type.String({ description: "Task ID (e.g., bd-42)" })
    }),
    async execute(_toolCallId: string, params: { id: string }, _signal?: unknown, _update?: unknown, ctx?: any) {
      const cwd = ctx?.cwd || process.cwd()
      return {
        content: [{ type: "text", text: runTmCommand(["close", params.id], cwd) }]
      }
    }
  })

  // tm sync
  pi.registerTool({
    name: "tm_sync",
    label: "Task Manager: Sync",
    description: "Synchronize local tasks with external backends (if configured).",
    parameters: Type.Object({}),
    async execute(_toolCallId: string, _params: any, _signal?: unknown, _update?: unknown, ctx?: any) {
      const cwd = ctx?.cwd || process.cwd()
      return {
        content: [{ type: "text", text: runTmCommand(["sync"], cwd) }]
      }
    }
  })
}
