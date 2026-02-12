import type { Plugin } from "@opencode-ai/plugin"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  DEFAULT_LIMITS,
  formatCassContext,
  normalizeLimits,
} from "../cass-memory/format.cjs"

type CassConfig = {
  enabled?: boolean
  timeoutMs?: number
  maxRules?: number
  maxWarnings?: number
  maxChars?: number
  logLevel?: string
}

type MemorySource = "serena" | "supermemory"

type MemoryEntry = {
  id: string
  content: string
  relevanceScore: number
  maturity: string
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

const asArray = (value: unknown) => (Array.isArray(value) ? value : [])

const normalizeEntry = (entry: any, source: MemorySource, index: number): MemoryEntry | null => {
  const id = String(entry?.id ?? entry?.key ?? entry?.memoryId ?? `${source}-${index + 1}`).trim()
  const content = String(entry?.content ?? entry?.text ?? entry?.summary ?? "").trim()
  if (!id || !content) return null

  const relevanceScore =
    typeof entry?.relevanceScore === "number"
      ? entry.relevanceScore
      : typeof entry?.score === "number"
        ? entry.score
        : typeof entry?.similarity === "number"
          ? entry.similarity
          : 0

  return {
    id,
    content,
    relevanceScore,
    maturity: source,
  }
}

const parseMemoryContext = (raw: string, source: MemorySource) => {
  if (!raw || typeof raw !== "string") {
    return { ok: false as const, entries: [] as MemoryEntry[], error: `${source} returned empty output` }
  }

  try {
    const parsed = JSON.parse(raw)
    const rootEntries = asArray((parsed as any)?.entries)
    const nestedEntries = asArray((parsed as any)?.data?.entries)
    const cassStyleEntries = asArray((parsed as any)?.data?.relevantBullets)
    const directCassStyleEntries = asArray((parsed as any)?.relevantBullets)

    const selectedEntries =
      rootEntries.length > 0
        ? rootEntries
        : nestedEntries.length > 0
          ? nestedEntries
          : cassStyleEntries.length > 0
            ? cassStyleEntries
            : directCassStyleEntries

    const entries = selectedEntries
      .map((entry: any, index: number) => normalizeEntry(entry, source, index))
      .filter((entry: MemoryEntry | null): entry is MemoryEntry => Boolean(entry))

    return { ok: true as const, entries }
  } catch (error) {
    return {
      ok: false as const,
      entries: [] as MemoryEntry[],
      error: error instanceof Error ? error.message : `${source} returned invalid json`,
    }
  }
}

const mergeEntries = (serenaEntries: MemoryEntry[], supermemoryEntries: MemoryEntry[], maxRules: number) => {
  const merged = new Map<string, MemoryEntry>()

  for (const entry of supermemoryEntries) {
    merged.set(entry.id.toLowerCase(), entry)
  }
  for (const entry of serenaEntries) {
    merged.set(entry.id.toLowerCase(), entry)
  }

  return Array.from(merged.values())
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore
      return a.id.localeCompare(b.id)
    })
    .slice(0, maxRules)
}

const runMemoryContext = async (
  shell: any,
  source: MemorySource,
  prompt: string,
  timeoutMs: number
): Promise<{ ok: boolean; output?: string; error?: string }> => {
  try {
    const process =
      source === "serena"
        ? shell`serena-memory context ${prompt} --json`
        : shell`supermemory-memory context ${prompt} --json`
    const output = await withTimeout(process.text(), timeoutMs)
    const exitCode = await process.exited

    if (exitCode !== 0) {
      return { ok: false, error: `${source} exited with code ${exitCode}` }
    }

    return { ok: true, output }
  } catch (error) {
    const message = error instanceof Error ? error.message : `${source} execution failed`
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
      const [serenaResult, supermemoryResult] = await Promise.all([
        runMemoryContext(ctx.$, "serena", prompt, config.timeoutMs),
        runMemoryContext(ctx.$, "supermemory", prompt, config.timeoutMs),
      ])

      if (!serenaResult.ok) {
        await appendLog(errorLogPath, serenaResult.error ?? "serena context failed", config.logLevel)
      }
      if (!supermemoryResult.ok) {
        await appendLog(errorLogPath, supermemoryResult.error ?? "supermemory context failed", config.logLevel)
      }

      if (!serenaResult.output && !supermemoryResult.output) {
        return
      }

      const serenaParsed = serenaResult.output ? parseMemoryContext(serenaResult.output, "serena") : null
      if (serenaParsed && !serenaParsed.ok) {
        await appendLog(errorLogPath, serenaParsed.error ?? "invalid serena context json", config.logLevel)
      }

      const supermemoryParsed = supermemoryResult.output
        ? parseMemoryContext(supermemoryResult.output, "supermemory")
        : null
      if (supermemoryParsed && !supermemoryParsed.ok) {
        await appendLog(errorLogPath, supermemoryParsed.error ?? "invalid supermemory context json", config.logLevel)
      }

      const mergedEntries = mergeEntries(
        serenaParsed?.ok ? serenaParsed.entries : [],
        supermemoryParsed?.ok ? supermemoryParsed.entries : [],
        limits.maxRules,
      )

      await writeJsonFile(lastContextPath, {
        serena: serenaResult.output ?? null,
        supermemory: supermemoryResult.output ?? null,
        mergedCount: mergedEntries.length,
      })

      if (mergedEntries.length === 0) return

      const block = formatCassContext({ relevantBullets: mergedEntries, antiPatterns: [] }, limits)
      if (!block) return

      output.args.prompt = `${block}\n\n${prompt}`
    },
  }
}

export default cassMemoryPlugin
