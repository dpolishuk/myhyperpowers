#!/usr/bin/env node

const { execFile } = require("child_process")
const fs = require("fs")
const path = require("path")
const { promisify } = require("util")

const execFileAsync = promisify(execFile)

const repoRoot = path.resolve(__dirname, "..", "..")
const configPath = path.join(repoRoot, ".opencode", "cass-memory.json")
const formatPath = path.join(repoRoot, ".opencode", "cass-memory", "format.cjs")
const contextPath = path.join(repoRoot, "hooks", "context", "cass-context.json")
const errorLogPath = path.join(repoRoot, "hooks", "context", "cass-errors.log")

const { formatCassContext, normalizeLimits } = require(formatPath)

const DEFAULT_CONFIG = {
  enabled: true,
  timeoutMs: 2500,
  maxRules: 5,
  maxWarnings: 5,
  maxChars: 1500,
  logLevel: "warn",
}

const loadConfig = () => {
  try {
    if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG }
    const raw = fs.readFileSync(configPath, "utf8")
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

const appendLog = (message, logLevel) => {
  if (logLevel === "silent") return
  const timestamp = new Date().toISOString()
  const line = `${timestamp} ${message}\n`
  fs.mkdirSync(path.dirname(errorLogPath), { recursive: true })
  fs.appendFileSync(errorLogPath, line, "utf8")
}

const writeContext = (raw) => {
  fs.mkdirSync(path.dirname(contextPath), { recursive: true })
  fs.writeFileSync(contextPath, JSON.stringify({ raw }, null, 2), "utf8")
}

const readPrompt = () =>
  new Promise((resolve) => {
    let data = ""
    process.stdin.on("data", (chunk) => {
      data += chunk
    })
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(data))
      } catch {
        resolve({ text: "" })
      }
    })
  })

const asArray = (value) => (Array.isArray(value) ? value : [])

const normalizeEntry = (entry, source, index) => {
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

const parseMemoryContext = (raw, source) => {
  if (!raw || typeof raw !== "string") {
    return { ok: false, entries: [], error: `${source} returned empty output` }
  }

  try {
    const parsed = JSON.parse(raw)
    const rootEntries = asArray(parsed?.entries)
    const nestedEntries = asArray(parsed?.data?.entries)
    const cassStyleEntries = asArray(parsed?.data?.relevantBullets)
    const directCassStyleEntries = asArray(parsed?.relevantBullets)

    const selectedEntries =
      rootEntries.length > 0
        ? rootEntries
        : nestedEntries.length > 0
          ? nestedEntries
          : cassStyleEntries.length > 0
            ? cassStyleEntries
            : directCassStyleEntries

    const entries = selectedEntries
      .map((entry, index) => normalizeEntry(entry, source, index))
      .filter(Boolean)

    return { ok: true, entries }
  } catch (error) {
    return {
      ok: false,
      entries: [],
      error: error instanceof Error ? error.message : `${source} returned invalid json`,
    }
  }
}

const mergeEntries = (serenaEntries, supermemoryEntries, maxRules) => {
  const merged = new Map()

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
    .slice(0, Math.max(0, maxRules || 0))
}

const runSourceContext = async (source, prompt, timeoutMs) => {
  const command = source === "serena" ? "serena-memory" : "supermemory-memory"

  try {
    const result = await execFileAsync(
      command,
      ["context", prompt, "--json"],
      { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 }
    )
    return { ok: true, output: result.stdout }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? `${source} context failed: ${error.message}`
          : `${source} context failed`,
    }
  }
}

const main = async () => {
  const config = loadConfig()
  if (!config.enabled) {
    console.log(JSON.stringify({}))
    return
  }

  const prompt = await readPrompt()
  if (!prompt.text || !prompt.text.trim()) {
    console.log(JSON.stringify({}))
    return
  }

  const [serenaResult, supermemoryResult] = await Promise.all([
    runSourceContext("serena", prompt.text, config.timeoutMs),
    runSourceContext("supermemory", prompt.text, config.timeoutMs),
  ])

  if (!serenaResult.ok) {
    appendLog(serenaResult.error || "serena context failed", config.logLevel)
  }
  if (!supermemoryResult.ok) {
    appendLog(supermemoryResult.error || "supermemory context failed", config.logLevel)
  }

  if (!serenaResult.output && !supermemoryResult.output) {
    console.log(JSON.stringify({}))
    return
  }

  const serenaParsed = serenaResult.output ? parseMemoryContext(serenaResult.output, "serena") : null
  if (serenaParsed && !serenaParsed.ok) {
    appendLog(serenaParsed.error || "invalid serena context json", config.logLevel)
  }

  const supermemoryParsed = supermemoryResult.output
    ? parseMemoryContext(supermemoryResult.output, "supermemory")
    : null
  if (supermemoryParsed && !supermemoryParsed.ok) {
    appendLog(supermemoryParsed.error || "invalid supermemory context json", config.logLevel)
  }

  const limits = normalizeLimits(config)
  const mergedEntries = mergeEntries(
    serenaParsed && serenaParsed.ok ? serenaParsed.entries : [],
    supermemoryParsed && supermemoryParsed.ok ? supermemoryParsed.entries : [],
    limits.maxRules
  )

  writeContext({
    serena: serenaResult.output || null,
    supermemory: supermemoryResult.output || null,
    mergedCount: mergedEntries.length,
  })

  if (mergedEntries.length === 0) {
    console.log(JSON.stringify({}))
    return
  }

  const block = formatCassContext({ relevantBullets: mergedEntries, antiPatterns: [] }, limits)
  if (!block) {
    console.log(JSON.stringify({}))
    return
  }

  console.log(JSON.stringify({ additionalContext: block }))
}

main()
