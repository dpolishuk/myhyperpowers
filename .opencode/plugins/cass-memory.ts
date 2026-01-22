import type { Plugin } from "@opencode-ai/plugin"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  DEFAULT_LIMITS,
  formatCassContext,
  normalizeLimits,
  parseCassContext,
} from "../cass-memory/format.cjs"

type CassConfig = {
  enabled?: boolean
  timeoutMs?: number
  maxRules?: number
  maxWarnings?: number
  maxChars?: number
  logLevel?: string
}

const DEFAULT_CONFIG: Required<CassConfig> = {
  enabled: true,
  timeoutMs: 2500,
  maxRules: DEFAULT_LIMITS.maxRules,
  maxWarnings: DEFAULT_LIMITS.maxWarnings,
  maxChars: DEFAULT_LIMITS.maxChars,
  logLevel: "warn",
}

const loadConfig = async (configPath: string): Promise<Required<CassConfig>> => {
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG }

  try {
    const raw = await readFile(configPath, "utf8")
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

const ensureDir = async (filePath: string) => {
  await mkdir(dirname(filePath), { recursive: true })
}

const appendLog = async (filePath: string, message: string, logLevel: string) => {
  if (logLevel === "silent") return
  await ensureDir(filePath)
  const timestamp = new Date().toISOString()
  await appendFile(filePath, `${timestamp} ${message}\n`, "utf8")
}

const writeJsonFile = async (filePath: string, payload: unknown) => {
  await ensureDir(filePath)
  const serialized = JSON.stringify(payload, null, 2)
  await writeFile(filePath, serialized, "utf8")
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const runCassContext = async (
  shell: any,
  prompt: string,
  timeoutMs: number
): Promise<{ ok: boolean; output?: string; error?: string }> => {
  try {
    const process = shell`cm context ${prompt} --json --no-history`
    const output = await withTimeout(process.text(), timeoutMs)
    const exitCode = await process.exited

    if (exitCode !== 0) {
      return { ok: false, error: `cm exited with code ${exitCode}` }
    }

    return { ok: true, output }
  } catch (error) {
    const message = error instanceof Error ? error.message : "cm execution failed"
    return { ok: false, error: message }
  }
}

const cassMemoryPlugin: Plugin = async (ctx) => {
  const configPath = join(ctx.directory, ".opencode", "cass-memory.json")
  const config = await loadConfig(configPath)
  const cacheDir = join(ctx.directory, ".opencode", "cache", "cass")
  const lastContextPath = join(cacheDir, "last-context.json")
  const errorLogPath = join(cacheDir, "errors.log")

  return {
    "tool.execute.before": async (input, output) => {
      if (!config.enabled) return
      if (input.tool !== "task") return

      const args = output.args ?? {}
      const prompt = typeof args.prompt === "string" ? args.prompt : ""
      if (!prompt.trim()) return
      if (prompt.startsWith("Cass Memory (rules)")) return

      const limits = normalizeLimits(config)
      const result = await runCassContext(ctx.$, prompt, config.timeoutMs)
      if (!result.ok || !result.output) {
        await appendLog(errorLogPath, result.error ?? "cm context failed", config.logLevel)
        return
      }

      await writeJsonFile(lastContextPath, { raw: result.output })

      const parsed = parseCassContext(result.output)
      if (!parsed.ok) {
        await appendLog(errorLogPath, parsed.error ?? "invalid cass json", config.logLevel)
        return
      }

      if (parsed.data && parsed.data.success === false) {
        const message = parsed.data.error || parsed.data.code || "cass reported failure"
        await appendLog(errorLogPath, message, config.logLevel)
        return
      }

      const block = formatCassContext(parsed.data, limits)
      if (!block) return

      output.args.prompt = `${block}\n\n${prompt}`
    },
  }
}

export default cassMemoryPlugin
