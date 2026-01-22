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

const { formatCassContext, normalizeLimits, parseCassContext } = require(formatPath)

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

const runCassContext = async (prompt, timeoutMs) => {
  const result = await execFileAsync(
    "cm",
    ["context", prompt, "--json", "--no-history"],
    { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 }
  )
  return result.stdout
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

  try {
    const raw = await runCassContext(prompt.text, config.timeoutMs)
    writeContext(raw)
    const parsed = parseCassContext(raw)
    if (!parsed.ok) {
      appendLog(parsed.error || "invalid cass json", config.logLevel)
      console.log(JSON.stringify({}))
      return
    }

    if (parsed.data && parsed.data.success === false) {
      const message = parsed.data.error || parsed.data.code || "cass reported failure"
      appendLog(message, config.logLevel)
      console.log(JSON.stringify({}))
      return
    }

    const block = formatCassContext(parsed.data, normalizeLimits(config))
    if (!block) {
      console.log(JSON.stringify({}))
      return
    }

    console.log(JSON.stringify({ additionalContext: block }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "cm context failed"
    appendLog(message, config.logLevel)
    console.log(JSON.stringify({}))
  }
}

main()
