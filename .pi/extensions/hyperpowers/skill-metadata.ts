export type PiSkillThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
export type PiSkillSubProcessContext = "fresh" | "fork"

export interface PiSkillMetadata {
  subProcess: boolean
  subProcessContext: PiSkillSubProcessContext
  model?: string
  thinkingLevel?: PiSkillThinkingLevel
}

const VALID_THINKING_LEVELS: PiSkillThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"]
const VALID_CONTEXTS: PiSkillSubProcessContext[] = ["fresh", "fork"]

function parseFrontmatter(content: string): Record<string, unknown> {
  const normalized = content.replace(/\r\n/g, "\n")
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return {}

  const root: Record<string, unknown> = {}
  const stack: Array<{ indent: number; value: Record<string, unknown> }> = [{ indent: -1, value: root }]

  for (const rawLine of match[1].split("\n")) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue
    const indent = rawLine.length - rawLine.trimStart().length
    const line = rawLine.trim()
    const separatorIndex = line.indexOf(":")
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const rawValue = line.slice(separatorIndex + 1).trim()

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]!.value
    if (!rawValue) {
      const child: Record<string, unknown> = {}
      parent[key] = child
      stack.push({ indent, value: child })
      continue
    }

    parent[key] = coerceScalar(rawValue)
  }

  return root
}

function coerceScalar(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed === "true") return true
  if (trimmed === "false") return false
  return trimmed.replace(/^['"]|['"]$/g, "")
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function normalizeThinkingLevel(value: unknown): PiSkillThinkingLevel | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim() as PiSkillThinkingLevel
  return VALID_THINKING_LEVELS.includes(trimmed) ? trimmed : undefined
}

function normalizeSubProcessContext(value: unknown): PiSkillSubProcessContext {
  if (typeof value !== "string") return "fresh"
  const trimmed = value.trim() as PiSkillSubProcessContext
  return VALID_CONTEXTS.includes(trimmed) ? trimmed : "fresh"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function parsePiSkillMetadata(frontmatter: Record<string, unknown>): PiSkillMetadata {
  const metadata = isRecord(frontmatter.metadata) ? frontmatter.metadata : undefined
  const pi = metadata && isRecord(metadata.pi) ? metadata.pi : undefined

  return {
    subProcess: pi?.subProcess === true,
    subProcessContext: normalizeSubProcessContext(pi?.subProcessContext),
    model: normalizeOptionalString(pi?.model),
    thinkingLevel: normalizeThinkingLevel(pi?.thinkingLevel),
  }
}

export function parsePiSkillMetadataFromSkillContent(content: string): PiSkillMetadata {
  return parsePiSkillMetadata(parseFrontmatter(content))
}
