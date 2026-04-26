import { exec } from "node:child_process"
import { join, dirname, resolve } from "node:path"
import { readFileSync, existsSync } from "node:fs"
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

function findRepoRoot(cwd: string): string {
  let current = cwd
  while (current !== "/" && current !== "") {
    if (existsSync(join(current, "hooks", "hooks.json"))) return current
    if (existsSync(join(current, ".git"))) return current
    current = dirname(current)
  }
  return cwd
}

function loadHooksConfig(cwd: string) {
  const root = findRepoRoot(cwd)
  const hooksPath = join(root, "hooks", "hooks.json")
  if (existsSync(hooksPath)) {
    try {
      return JSON.parse(readFileSync(hooksPath, "utf8"))
    } catch (e) {
      console.error("Failed to parse hooks.json", e)
    }
  }
  return { hooks: {} }
}

async function runHookCommand(command: string, cwd: string, inputData?: any, timeout = 5000): Promise<any> {
  const root = findRepoRoot(cwd)
  const finalCommand = command.replace(/\${CLAUDE_PLUGIN_ROOT}/g, root)

  return new Promise((resolve, reject) => {
    const child = exec(finalCommand, {
      cwd: root,
      timeout,
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: root }
    }, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }
      if (stdout) {
        try {
          resolve(JSON.parse(stdout))
        } catch {
          resolve(stdout)
        }
      } else {
        resolve(null)
      }
    })

    if (inputData) {
      child.stdin?.write(JSON.stringify(inputData) + "\n")
      child.stdin?.end()
    }
  })
}

const TOOL_NAME_MAP: Record<string, string> = {
  bash: "Bash",
  edit: "Edit",
  read: "Read",
  write: "Write",
  grep: "Grep",
  notebook_edit: "NotebookEdit",
}

function toClaudeToolName(name: string): string {
  return TOOL_NAME_MAP[name] ?? name
}

export function registerHooksPipeline(pi: ExtensionAPI) {
  // session_start (SessionStart)
  pi.on("session_start", async (event, ctx) => {
    const cwd = ctx.cwd || process.cwd()
    const config = loadHooksConfig(cwd)
    const hooks = config.hooks || {}

    if (hooks.SessionStart?.length > 0) {
      const matchers = hooks.SessionStart.filter((h: any) => {
        if (!h.matcher) return true
        try {
          return new RegExp(h.matcher).test(event.reason)
        } catch {
          return false
        }
      })
      for (const handler of matchers) {
        for (const hook of handler.hooks || []) {
          if (hook.type === "command") {
            try {
              await runHookCommand(hook.command, cwd, { event: "session_start", reason: event.reason })
            } catch (e) {
              console.error("SessionStart hook failed:", e)
            }
          }
        }
      }
    }
  })

  // input (UserPromptSubmit)
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension" || event.text.startsWith("/")) return { action: "continue" }

    const cwd = ctx.cwd || process.cwd()
    const config = loadHooksConfig(cwd)
    const hooks = config.hooks || {}

    if (hooks.UserPromptSubmit?.length > 0) {
      let accumulatedContext = ""
      for (const handler of hooks.UserPromptSubmit) {
        for (const hook of handler.hooks || []) {
          if (hook.type === "command") {
            try {
              const out = await runHookCommand(hook.command, cwd, { text: event.text })
              if (out?.additionalContext) {
                accumulatedContext += `\n\n${out.additionalContext}`
              }
            } catch (e) {
              console.error("UserPromptSubmit hook failed:", e)
            }
          }
        }
      }
      if (accumulatedContext) {
        return { 
          action: "transform", 
          text: `${event.text}${accumulatedContext}`
        }
      }
    }
    return { action: "continue" }
  })

  // tool_call (PreToolUse)
  pi.on("tool_call", async (event, ctx) => {
    let effectiveToolName = event.toolName
    let effectiveInput = event.input
    if (effectiveToolName.startsWith("tm_")) {
      const sub = event.toolName.slice(3)
      const argv = Object.entries(event.input || {})
        .map(([k, v]) => `--${k}=${JSON.stringify(v)}`)
        .join(" ")
      effectiveToolName = "bash"
      effectiveInput = { command: `tm ${sub} ${argv}`.trim() }
    }
    const claudeName = toClaudeToolName(effectiveToolName)
    const cwd = ctx.cwd || process.cwd()
    const config = loadHooksConfig(cwd)
    const hooks = config.hooks || {}

    if (hooks.PreToolUse?.length > 0) {
      for (const handler of hooks.PreToolUse) {
        let match = false
        try {
          match = !handler.matcher || new RegExp(handler.matcher).test(claudeName)
        } catch {
          match = false
        }
        if (match) {
          for (const hook of handler.hooks || []) {
            if (hook.type === "command") {
              const payload = {
                tool_name: claudeName,
                tool_input: effectiveInput
              }
              let out: any
              try {
                out = await runHookCommand(hook.command, cwd, payload)
              } catch (e: any) {
                return { block: true, reason: `Hook execution failed: ${e.message}` }
              }
              
              const hookOut = out?.hookSpecificOutput
              if (hookOut && typeof hookOut === "object" && hookOut.permissionDecision === "deny") {
                return { block: true, reason: hookOut.permissionDecisionReason || "Blocked by hook" }
              }
            }
          }
        }
      }
    }
  })

  // tool_result (PostToolUse)
  pi.on("tool_result", async (event, ctx) => {
    let effectiveToolName = event.toolName
    let effectiveInput = event.input
    if (effectiveToolName.startsWith("tm_")) {
      const sub = event.toolName.slice(3)
      const argv = Object.entries(event.input || {})
        .map(([k, v]) => `--${k}=${JSON.stringify(v)}`)
        .join(" ")
      effectiveToolName = "bash"
      effectiveInput = { command: `tm ${sub} ${argv}`.trim() }
    }
    const claudeName = toClaudeToolName(effectiveToolName)
    const cwd = ctx.cwd || process.cwd()
    const config = loadHooksConfig(cwd)
    const hooks = config.hooks || {}

    if (hooks.PostToolUse?.length > 0) {
      for (const handler of hooks.PostToolUse) {
        let match = false
        try {
          match = !handler.matcher || new RegExp(handler.matcher).test(claudeName)
        } catch {
          match = false
        }
        if (match) {
          for (const hook of handler.hooks || []) {
            if (hook.type === "command") {
              const payload = {
                tool_name: claudeName,
                tool_input: effectiveInput,
                tool_output: {
                  content: typeof event.content === "string" ? event.content : JSON.stringify(event.content),
                  is_error: event.isError || false
                }
              }
              let out: any
              try {
                out = await runHookCommand(hook.command, cwd, payload)
              } catch (e: any) {
                return { 
                  isError: true, 
                  content: [{ type: "text", text: `Hook execution failed: ${e.message}` }] 
                }
              }
              
              const hookOut = out?.hookSpecificOutput
              if (hookOut && typeof hookOut === "object" && hookOut.permissionDecision === "deny") {
                return { 
                  isError: true, 
                  content: [{ type: "text", text: `Hook blocked result: ${hookOut.permissionDecisionReason}` }] 
                }
              }
            }
          }
        }
      }
    }
  })

  // Stop (session_shutdown)
  pi.on("session_shutdown", async (event, ctx) => {
    const cwd = ctx.cwd || process.cwd()
    const config = loadHooksConfig(cwd)
    const hooks = config.hooks || {}

    if (hooks.Stop?.length > 0) {
      for (const handler of hooks.Stop) {
        for (const hook of handler.hooks || []) {
          if (hook.type === "command") {
            try {
              await runHookCommand(hook.command, cwd, { event: "session_shutdown" })
            } catch (e) {
              console.error("Session_shutdown hook failed:", e)
            }
          }
        }
      }
    }
  })
}
