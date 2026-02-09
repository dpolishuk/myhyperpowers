import type { Plugin } from "@opencode-ai/plugin"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"

type TaskContextConfig = {
  enabled?: boolean
  timeoutMs?: number
  retries?: number
  maxItems?: number
  maxChars?: number
  maxSummaryCount?: number
  maxSummaryAgeHours?: number
  logLevel?: "silent" | "warn"
}

type TaskMemoryEntry = {
  key: string
  content: string
  score: number
  timestamp: number
  source: "serena" | "supermemory"
}

type TaskSummaryRecord = {
  run_id: string
  task_fingerprint: string
  prompt_excerpt: string
  status: string
  narrative: string
  timestamp: string
}

const DEFAULT_CONFIG: Required<TaskContextConfig> = {
  enabled: true,
  timeoutMs: 2500,
  retries: 1,
  maxItems: 8,
  maxChars: 1500,
  maxSummaryCount: 50,
  maxSummaryAgeHours: 72,
  logLevel: "warn",
}

const normalizeConfig = (config: TaskContextConfig): Required<TaskContextConfig> => {
  const merged = { ...DEFAULT_CONFIG, ...config }
  return {
    enabled: Boolean(merged.enabled),
    timeoutMs: Math.max(200, Number(merged.timeoutMs) || DEFAULT_CONFIG.timeoutMs),
    retries: Math.max(0, Number(merged.retries) || DEFAULT_CONFIG.retries),
    maxItems: Math.max(1, Number(merged.maxItems) || DEFAULT_CONFIG.maxItems),
    maxChars: Math.max(120, Number(merged.maxChars) || DEFAULT_CONFIG.maxChars),
    maxSummaryCount: Math.max(1, Number(merged.maxSummaryCount) || DEFAULT_CONFIG.maxSummaryCount),
    maxSummaryAgeHours: Math.max(1, Number(merged.maxSummaryAgeHours) || DEFAULT_CONFIG.maxSummaryAgeHours),
    logLevel: merged.logLevel === "silent" ? "silent" : "warn",
  }
}

const ensureDir = async (filePath: string) => {
  await mkdir(dirname(filePath), { recursive: true })
}

const appendStructuredLog = async (
  filePath: string,
  payload: Record<string, unknown>,
  logLevel: "silent" | "warn",
) => {
  if (logLevel === "silent") return
  await ensureDir(filePath)
  await appendFile(
    filePath,
    `${JSON.stringify({ timestamp: new Date().toISOString(), ...payload })}\n`,
    "utf8",
  )
}

const writeJsonFile = async (filePath: string, payload: unknown) => {
  await ensureDir(filePath)
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8")
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const sourceCommand = (
  source: "serena" | "supermemory",
  mode: "context" | "summaries" | "save",
  shell: any,
  payload: string,
  narrative?: string,
) => {
  if (source === "serena" && mode === "context") {
    return shell`serena-memory context ${payload} --json`
  }
  if (source === "serena" && mode === "summaries") {
    return shell`serena-memory summaries ${payload} --json`
  }
  if (source === "serena") {
    return shell`serena-memory save ${payload} ${narrative ?? ""} --json`
  }
  if (mode === "context") {
    return shell`supermemory-memory context ${payload} --json`
  }
  if (mode === "summaries") {
    return shell`supermemory-memory summaries ${payload} --json`
  }
  return shell`supermemory-memory save ${payload} ${narrative ?? ""} --json`
}

const runSourceOperation = async (
  source: "serena" | "supermemory",
  mode: "context" | "summaries" | "save",
  shell: any,
  payload: string,
  timeoutMs: number,
  retries: number,
  narrative?: string,
) => {
  let lastError = "unknown"
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const process = sourceCommand(source, mode, shell, payload, narrative)
      const output = await withTimeout(process.text(), timeoutMs)
      const exitCode = await process.exited
      if (exitCode === 0) {
        return { ok: true as const, output }
      }
      lastError = `${source} ${mode} exited with code ${exitCode}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : `${source} ${mode} execution failed`
    }
  }

  return { ok: false as const, error: lastError }
}

const asArray = (value: unknown) => (Array.isArray(value) ? value : [])

const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")

const hashPrompt = (input: string) => {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

const parseSourceEntries = (source: "serena" | "supermemory", output: string): TaskMemoryEntry[] => {
  const payload = JSON.parse(output)
  const rootEntries = asArray((payload as any)?.entries)
  const nestedEntries = asArray((payload as any)?.data?.entries)
  const entries = rootEntries.length > 0 ? rootEntries : nestedEntries

  return entries
    .map((entry: any) => {
      const id = String(entry?.id ?? entry?.key ?? "").trim()
      const content = String(entry?.content ?? entry?.text ?? entry?.summary ?? "").trim()
      if (!id || !content) return null
      const score = typeof entry?.score === "number" ? entry.score : 0
      const timestamp = Number(new Date(entry?.timestamp ?? 0).getTime())

      return {
        key: normalizeKey(id),
        content,
        score,
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
        source,
      }
    })
    .filter((entry: TaskMemoryEntry | null): entry is TaskMemoryEntry => Boolean(entry))
}

const mergeEntries = (
  serenaEntries: TaskMemoryEntry[],
  supermemoryEntries: TaskMemoryEntry[],
  maxItems: number,
) => {
  const merged = new Map<string, TaskMemoryEntry>()

  for (const entry of supermemoryEntries) {
    merged.set(entry.key, entry)
  }
  for (const entry of serenaEntries) {
    merged.set(entry.key, entry)
  }

  return Array.from(merged.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp
      return a.key.localeCompare(b.key)
    })
    .slice(0, maxItems)
}

const applyTruncation = (text: string, maxChars: number) => {
  if (text.length <= maxChars) return text
  const marker = "\n(truncated)"
  const sliceLength = Math.max(0, maxChars - marker.length)
  return `${text.slice(0, sliceLength).trimEnd()}${marker}`
}

const formatContextPack = (entries: TaskMemoryEntry[], maxChars: number) => {
  if (entries.length === 0) return null

  const lines = ["Task Context Pack"]
  for (const entry of entries) {
    lines.push(`- [${entry.source}] ${entry.key}: ${entry.content}`)
  }

  return applyTruncation(lines.join("\n"), maxChars)
}

const readSummaryCache = async (filePath: string): Promise<TaskSummaryRecord[]> => {
  if (!existsSync(filePath)) return []
  try {
    const raw = await readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as TaskSummaryRecord[]) : []
  } catch {
    return []
  }
}

const trimSummaries = (
  summaries: TaskSummaryRecord[],
  maxSummaryCount: number,
  maxSummaryAgeHours: number,
) => {
  const cutoff = Date.now() - maxSummaryAgeHours * 60 * 60 * 1000
  return summaries
    .filter((summary) => {
      const ts = Number(new Date(summary.timestamp).getTime())
      return Number.isFinite(ts) && ts >= cutoff
    })
    .sort((a, b) => Number(new Date(b.timestamp).getTime()) - Number(new Date(a.timestamp).getTime()))
    .slice(0, maxSummaryCount)
}

const summariesToEntries = (summaries: TaskSummaryRecord[]): TaskMemoryEntry[] => {
  return summaries.map((summary) => ({
    key: normalizeKey(`summary:${summary.task_fingerprint}`),
    content: summary.narrative,
    score: 2,
    timestamp: Number(new Date(summary.timestamp).getTime()) || 0,
    source: "serena",
  }))
}

const loadConfig = async (configPath: string) => {
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG }
  try {
    const raw = await readFile(configPath, "utf8")
    const parsed = JSON.parse(raw)
    return normalizeConfig(parsed)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

const taskContextOrchestratorPlugin: Plugin = async (ctx) => {
  const configPath = join(ctx.directory, ".opencode", "task-context.json")
  const config = await loadConfig(configPath)
  const cacheDir = join(ctx.directory, ".opencode", "cache", "task-context")
  const errorLogPath = join(cacheDir, "errors.log")
  const lastContextPath = join(cacheDir, "last-context.json")
  const summariesPath = join(cacheDir, "summaries.json")

  return {
    "tool.execute.before": async (input, output) => {
      if (!config.enabled) return
      if (input.tool !== "task") return

      const args = output.args ?? {}
      const prompt = typeof args.prompt === "string" ? args.prompt : ""
      if (!prompt.trim()) return
      if (prompt.startsWith("Task Context Pack")) return

      const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      ;(output.args as any).__taskContextRunId = runId
      ;(output.args as any).__taskContextFingerprint = hashPrompt(prompt)

      const serenaResult = await runSourceOperation(
        "serena",
        "context",
        ctx.$,
        prompt,
        config.timeoutMs,
        config.retries,
      )
      const supermemoryResult = await runSourceOperation(
        "supermemory",
        "context",
        ctx.$,
        prompt,
        config.timeoutMs,
        config.retries,
      )
      const serenaSummaryResult = await runSourceOperation(
        "serena",
        "summaries",
        ctx.$,
        prompt,
        config.timeoutMs,
        config.retries,
      )
      const supermemorySummaryResult = await runSourceOperation(
        "supermemory",
        "summaries",
        ctx.$,
        prompt,
        config.timeoutMs,
        config.retries,
      )

      const serenaEntries: TaskMemoryEntry[] = []
      const supermemoryEntries: TaskMemoryEntry[] = []

      if (!serenaResult.ok) {
        await appendStructuredLog(
          errorLogPath,
          { run_id: runId, source: "serena", operation: "fetch", error: serenaResult.error },
          config.logLevel,
        )
      } else {
        try {
          serenaEntries.push(...parseSourceEntries("serena", serenaResult.output))
        } catch (error) {
          await appendStructuredLog(
            errorLogPath,
            {
              run_id: runId,
              source: "serena",
              operation: "parse",
              error: error instanceof Error ? error.message : "invalid serena payload",
            },
            config.logLevel,
          )
        }
      }

      if (!supermemoryResult.ok) {
        await appendStructuredLog(
          errorLogPath,
          { run_id: runId, source: "supermemory", operation: "fetch", error: supermemoryResult.error },
          config.logLevel,
        )
      } else {
        try {
          supermemoryEntries.push(...parseSourceEntries("supermemory", supermemoryResult.output))
        } catch (error) {
          await appendStructuredLog(
            errorLogPath,
            {
              run_id: runId,
              source: "supermemory",
              operation: "parse",
              error: error instanceof Error ? error.message : "invalid supermemory payload",
            },
            config.logLevel,
          )
        }
      }

      if (serenaSummaryResult.ok) {
        try {
          serenaEntries.push(...parseSourceEntries("serena", serenaSummaryResult.output))
        } catch {
          // no-op: summary parsing should not block task execution
        }
      }
      if (supermemorySummaryResult.ok) {
        try {
          supermemoryEntries.push(...parseSourceEntries("supermemory", supermemorySummaryResult.output))
        } catch {
          // no-op: summary parsing should not block task execution
        }
      }

      const cachedSummaries = trimSummaries(
        await readSummaryCache(summariesPath),
        config.maxSummaryCount,
        config.maxSummaryAgeHours,
      )
      serenaEntries.push(...summariesToEntries(cachedSummaries))

      const merged = mergeEntries(serenaEntries, supermemoryEntries, config.maxItems)
      await writeJsonFile(lastContextPath, { run_id: runId, entries: merged })

      const contextPack = formatContextPack(merged, config.maxChars)
      if (!contextPack) return

      output.args.prompt = `${contextPack}\n\n${prompt}`
    },
    "tool.execute.after": async (input, output) => {
      if (!config.enabled) return
      if (input.tool !== "task") return

      const args = (output.args ?? {}) as Record<string, unknown>
      const prompt = typeof args.prompt === "string" ? args.prompt : ""
      const runId =
        typeof args.__taskContextRunId === "string"
          ? args.__taskContextRunId
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const taskFingerprint =
        typeof args.__taskContextFingerprint === "string"
          ? args.__taskContextFingerprint
          : hashPrompt(prompt)

      const resultPayload = (output as any)?.result
      const status = typeof resultPayload?.status === "string" ? resultPayload.status : "unknown"
      const resultText = typeof resultPayload?.message === "string" ? resultPayload.message : ""

      const jsonSummary = {
        run_id: runId,
        task_fingerprint: taskFingerprint,
        status,
        timestamp: new Date().toISOString(),
      }
      const narrativeSummary = `Task ${taskFingerprint} finished with status ${status}${
        resultText ? `: ${resultText.slice(0, 180)}` : ""
      }`

      const serenaSave = await runSourceOperation(
        "serena",
        "save",
        ctx.$,
        JSON.stringify(jsonSummary),
        config.timeoutMs,
        config.retries,
        narrativeSummary,
      )
      if (!serenaSave.ok) {
        await appendStructuredLog(
          errorLogPath,
          { run_id: runId, source: "serena", operation: "save", error: serenaSave.error },
          config.logLevel,
        )
      }

      const supermemorySave = await runSourceOperation(
        "supermemory",
        "save",
        ctx.$,
        JSON.stringify(jsonSummary),
        config.timeoutMs,
        config.retries,
        narrativeSummary,
      )
      if (!supermemorySave.ok) {
        await appendStructuredLog(
          errorLogPath,
          { run_id: runId, source: "supermemory", operation: "save", error: supermemorySave.error },
          config.logLevel,
        )
      }

      const existing = await readSummaryCache(summariesPath)
      if (!existing.some((item) => item.run_id === runId || item.task_fingerprint === taskFingerprint)) {
        const next: TaskSummaryRecord[] = [
          {
            run_id: runId,
            task_fingerprint: taskFingerprint,
            prompt_excerpt: prompt.slice(0, 160),
            status,
            narrative: narrativeSummary,
            timestamp: new Date().toISOString(),
          },
          ...existing,
        ]
        await writeJsonFile(
          summariesPath,
          trimSummaries(next, config.maxSummaryCount, config.maxSummaryAgeHours),
        )
      }
    },
  }
}

export default taskContextOrchestratorPlugin
