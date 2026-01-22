const DEFAULT_LIMITS = {
  maxRules: 5,
  maxWarnings: 5,
  maxChars: 1500,
}

const normalizeNumber = (value, fallback) => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback
  if (!Number.isFinite(value)) return fallback
  return value
}

const normalizeLimits = (options = {}) => {
  return {
    maxRules: Math.max(0, normalizeNumber(options.maxRules, DEFAULT_LIMITS.maxRules)),
    maxWarnings: Math.max(0, normalizeNumber(options.maxWarnings, DEFAULT_LIMITS.maxWarnings)),
    maxChars: Math.max(120, normalizeNumber(options.maxChars, DEFAULT_LIMITS.maxChars)),
  }
}

const parseCassContext = (jsonText) => {
  if (!jsonText || typeof jsonText !== "string") {
    return { ok: false, error: "empty input" }
  }

  try {
    return { ok: true, data: JSON.parse(jsonText) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid json" }
  }
}

const safeArray = (value) => (Array.isArray(value) ? value : [])

const compareBullets = (a, b) => {
  const aRel = typeof a.relevanceScore === "number" ? a.relevanceScore : 0
  const bRel = typeof b.relevanceScore === "number" ? b.relevanceScore : 0
  if (bRel !== aRel) return bRel - aRel

  const aScore = typeof a.effectiveScore === "number" ? a.effectiveScore : 0
  const bScore = typeof b.effectiveScore === "number" ? b.effectiveScore : 0
  if (bScore !== aScore) return bScore - aScore

  const aId = String(a.id ?? "")
  const bId = String(b.id ?? "")
  return aId.localeCompare(bId)
}

const formatBulletLine = (bullet) => {
  const id = String(bullet.id ?? "").trim()
  const content = String(bullet.content ?? "").trim()
  if (!id || !content) return null

  const maturity = String(bullet.maturity ?? "").trim()
  if (maturity) {
    return `- ${id} (${maturity}): ${content}`
  }
  return `- ${id}: ${content}`
}

const applyTruncation = (text, maxChars) => {
  if (text.length <= maxChars) return text

  const marker = "\n(truncated)"
  const sliceLength = Math.max(0, maxChars - marker.length)
  return text.slice(0, sliceLength).trimEnd() + marker
}

const formatCassContext = (context, options = {}) => {
  if (!context || context.success === false) return null

  const payload =
    context && typeof context.data === "object" && context.data !== null ? context.data : context

  const limits = normalizeLimits(options)
  const relevant = safeArray(payload.relevantBullets)
    .slice()
    .sort(compareBullets)
    .slice(0, limits.maxRules)
  const warnings = safeArray(payload.antiPatterns)
    .slice()
    .sort(compareBullets)
    .slice(0, limits.maxWarnings)

  const ruleLines = relevant.map(formatBulletLine).filter(Boolean)
  const warningLines = warnings.map(formatBulletLine).filter(Boolean)

  if (ruleLines.length === 0 && warningLines.length === 0) return null

  const lines = []

  if (ruleLines.length > 0) {
    lines.push("Cass Memory (rules)")
    lines.push(...ruleLines)
  }

  if (warningLines.length > 0) {
    if (lines.length > 0) lines.push("")
    lines.push("Cass Warnings")
    lines.push(...warningLines)
  }

  return applyTruncation(lines.join("\n"), limits.maxChars)
}

module.exports = {
  DEFAULT_LIMITS,
  formatCassContext,
  normalizeLimits,
  parseCassContext,
}
