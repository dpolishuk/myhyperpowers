import { spawnSync } from "node:child_process"
import { join, resolve, dirname } from "node:path"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent"

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url))
// For development, this resolves to /root/work/myhyperpowers
const REPO_ROOT = resolve(SOURCE_DIR, "..", "..", "..")
const HOOKS_JSON_PATH = join(REPO_ROOT, "hooks", "hooks.json")

function loadHooksConfig() {
  if (existsSync(HOOKS_JSON_PATH)) {
    try {
      return JSON.parse(readFileSync(HOOKS_JSON_PATH, "utf8"))
    } catch (e) {
      console.error("Failed to parse hooks.json", e)
    }
  }
  return { hooks: {} }
}

function runHookCommand(command: string, inputData?: any, timeout = 5000): any {
  const finalCommand = command.replace("${CLAUDE_PLUGIN_ROOT}", REPO_ROOT)
  const parts = finalCommand.split(" ")
  const bin = parts[0]!
  const args = parts.slice(1)

  const result = spawnSync(bin, args, {
    input: inputData ? JSON.stringify(inputData) : undefined,
    encoding: "utf8",
    cwd: REPO_ROOT,
    timeout,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: REPO_ROOT }
  })

  if (result.stdout) {
    try {
      return JSON.parse(result.stdout)
    } catch {
      return result.stdout
    }
  }
  return null
}

function camelCaseToolName(name: string): string {
  if (name === "bash") return "Bash"
  if (name === "edit") return "Edit"
  if (name === "read") return "Read"
  if (name === "write") return "Write"
  return name
}

export function registerHooksPipeline(pi: ExtensionAPI) {
  const config = loadHooksConfig()
  const hooks = config.hooks || {}

  // session_start (SessionStart)
  if (hooks.SessionStart?.length > 0) {
    pi.on("session_start", async (event, ctx) => {
      const matchers = hooks.SessionStart.filter((h: any) => h.matcher?.includes(event.reason) || !h.matcher)
      for (const handler of matchers) {
        for (const hook of handler.hooks || []) {
          if (hook.type === "command") {
            runHookCommand(hook.command, { event: "session_start", reason: event.reason })
          }
        }
      }
    })
  }

  // input (UserPromptSubmit)
  if (hooks.UserPromptSubmit?.length > 0) {
    pi.on("input", async (event, ctx) => {
      // Skip if it's already a handled skill or an extension-generated prompt
      if (event.source === "extension" || event.text.startsWith("/")) return { action: "continue" }

      for (const handler of hooks.UserPromptSubmit) {
        for (const hook of handler.hooks || []) {
          if (hook.type === "command") {
            const out = runHookCommand(hook.command, { text: event.text })
            if (out?.additionalContext) {
              return { 
                action: "transform", 
                text: `${event.text}\n\n${out.additionalContext}`
              }
            }
          }
        }
      }
      return { action: "continue" }
    })
  }

  // tool_call (PreToolUse)
  if (hooks.PreToolUse?.length > 0) {
    pi.on("tool_call", async (event, ctx) => {
      const camelName = camelCaseToolName(event.toolName)

      for (const handler of hooks.PreToolUse) {
        if (!handler.matcher || new RegExp(handler.matcher).test(camelName)) {
          for (const hook of handler.hooks || []) {
            if (hook.type === "command") {
              const payload = {
                tool_name: camelName,
                tool_input: event.input
              }
              const out = runHookCommand(hook.command, payload)
              const hookOut = out?.hookSpecificOutput
              
              if (hookOut?.permissionDecision === "deny") {
                return { block: true, reason: hookOut.permissionDecisionReason || "Blocked by hook" }
              }
            }
          }
        }
      }
    })
  }

  // tool_result (PostToolUse)
  if (hooks.PostToolUse?.length > 0) {
    pi.on("tool_result", async (event, ctx) => {
      const camelName = camelCaseToolName(event.toolName)

      for (const handler of hooks.PostToolUse) {
        if (!handler.matcher || new RegExp(handler.matcher).test(camelName)) {
          for (const hook of handler.hooks || []) {
            if (hook.type === "command") {
              const payload = {
                tool_name: camelName,
                tool_input: event.input,
                tool_output: {
                  content: typeof event.content === "string" ? event.content : JSON.stringify(event.content),
                  is_error: event.isError || false
                }
              }
              const out = runHookCommand(hook.command, payload)
              const hookOut = out?.hookSpecificOutput

              if (hookOut?.permissionDecision === "deny") {
                // To block after execution, we can override the result with the error
                return { 
                  isError: true, 
                  content: [{ type: "text", text: `Hook blocked result: ${hookOut.permissionDecisionReason}` }] 
                }
              }
            }
          }
        }
      }
    })
  }

  // Stop (session_shutdown)
  if (hooks.Stop?.length > 0) {
    pi.on("session_shutdown", async (event, ctx) => {
      for (const handler of hooks.Stop) {
        for (const hook of handler.hooks || []) {
          if (hook.type === "command") {
            runHookCommand(hook.command, { event: "session_shutdown" })
          }
        }
      }
    })
  }
}
