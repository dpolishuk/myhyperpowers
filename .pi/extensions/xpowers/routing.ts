export type RoutingEntry = { model?: string; effort?: string }
export type RoutingMap = Record<string, RoutingEntry>
export interface RoutingConfig {
  subagents: RoutingMap
  agents: RoutingMap
}

export interface XPowersAgentDefinition {
  name: string
  type: string
  group: "workers" | "reviewers"
  description: string
}

export const DEFAULT_ROUTING_COMMENT =
  "Model format: 'provider/model' (e.g., 'anthropic/claude-haiku-4-5', 'ollama/llama3.1:8b') or 'inherit' for session model"

export const XPOWERS_AGENTS: XPowersAgentDefinition[] = [
  { name: "ralph", type: "orchestration", group: "workers", description: "Autonomous executor (YOLO mode)" },
  { name: "planner", type: "research", group: "workers", description: "Architecture and task planning" },
  { name: "code-reviewer", type: "review", group: "reviewers", description: "Code review, quality checks" },
  { name: "autonomous-reviewer", type: "validation", group: "reviewers", description: "Final review and validation" },
  { name: "review-quality", type: "review", group: "reviewers", description: "Focused review for bugs, safety, and code quality" },
  { name: "review-implementation", type: "validation", group: "reviewers", description: "Verify implementation matches requirements" },
  { name: "review-simplification", type: "review", group: "reviewers", description: "Identify unnecessary complexity and simplifications" },
  { name: "review-testing", type: "review", group: "reviewers", description: "Review test quality and missing coverage" },
  { name: "review-documentation", type: "review", group: "reviewers", description: "Review docs for correctness and completeness" },
  { name: "security-scanner", type: "review", group: "reviewers", description: "Dedicated security audit and vulnerability scanning" },
  { name: "test-effectiveness-analyst", type: "validation", group: "reviewers", description: "Audit tests for strength, realism, and gaps" },
  { name: "codebase-investigator", type: "research", group: "workers", description: "Find existing patterns in the codebase" },
  { name: "internet-researcher", type: "research", group: "workers", description: "Research external docs and APIs" },
  { name: "knowledge-aggregator", type: "research", group: "workers", description: "Consolidate information from multiple sources" },
  { name: "devops", type: "review", group: "guards", description: "Pipeline health checks and deployment verification" },
  { name: "test-runner", type: "test-runner", group: "workers", description: "Run tests in isolated subprocesses" },
]

const DEFAULT_SUBAGENTS: RoutingMap = {
  review: { model: "inherit" },
  research: { model: "inherit" },
  validation: { model: "inherit" },
  "test-runner": { model: "inherit" },
  default: { model: "inherit" },
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const normalizeEntry = (value: unknown): RoutingEntry | undefined => {
  if (!isObject(value)) return undefined
  const entry: RoutingEntry = {}
  if (typeof value.model === "string") entry.model = value.model
  if (typeof value.effort === "string") entry.effort = value.effort
  return entry.model !== undefined || entry.effort !== undefined ? entry : undefined
}

const normalizeMap = (value: unknown): RoutingMap => {
  if (!isObject(value)) return {}
  const map: RoutingMap = {}
  for (const [key, raw] of Object.entries(value)) {
    const entry = normalizeEntry(raw)
    if (entry) map[key] = entry
  }
  return map
}

export function normalizeRoutingConfig(raw: unknown): RoutingConfig {
  const source = isObject(raw) ? raw : {}
  const subagents = { ...DEFAULT_SUBAGENTS, ...normalizeMap(source.subagents) }
  const agents = normalizeMap(source.agents)
  return { subagents, agents }
}

export function serializeRoutingConfig(config: RoutingConfig): string {
  return JSON.stringify(
    {
      _comment: DEFAULT_ROUTING_COMMENT,
      subagents: config.subagents,
      agents: config.agents,
    },
    null,
    2,
  ) + "\n"
}

export interface ResolveRoutingParams {
  explicitModel?: string
  agent?: string
  type?: string
}

export interface ResolvedRoutingEntry {
  source: "explicit" | "agent" | "type" | "default" | "inherit"
  model: string | null
  effort?: string
}

const materialize = (
  source: ResolvedRoutingEntry["source"],
  entry: RoutingEntry | undefined,
): ResolvedRoutingEntry => ({
  source,
  model: entry?.model && entry.model !== "inherit" ? entry.model : null,
  effort: entry?.effort,
})

export function resolveRoutingEntry(
  config: RoutingConfig,
  params: ResolveRoutingParams,
): ResolvedRoutingEntry {
  if (params.explicitModel) {
    return { source: "explicit", model: params.explicitModel }
  }

  if (params.agent && config.agents[params.agent]) {
    return materialize("agent", config.agents[params.agent])
  }

  if (params.type && config.subagents[params.type]) {
    return materialize("type", config.subagents[params.type])
  }

  if (config.subagents.default) {
    const resolved = materialize("default", config.subagents.default)
    if (resolved.model !== null || resolved.effort !== undefined) return resolved
  }

  return { source: "inherit", model: null }
}

export function withSubagentModel(config: RoutingConfig, type: string, model: string): RoutingConfig {
  return {
    subagents: {
      ...config.subagents,
      [type]: { ...config.subagents[type], model },
    },
    agents: { ...config.agents },
  }
}

export function withAgentModel(config: RoutingConfig, agent: string, model: string): RoutingConfig {
  return {
    subagents: { ...config.subagents },
    agents: {
      ...config.agents,
      [agent]: { ...config.agents[agent], model },
    },
  }
}

export function withoutAgentOverride(config: RoutingConfig, agent: string): RoutingConfig {
  const agents = { ...config.agents }
  delete agents[agent]
  return {
    subagents: { ...config.subagents },
    agents,
  }
}

export function resetAllAgentOverrides(config: RoutingConfig): RoutingConfig {
  return {
    subagents: { ...config.subagents },
    agents: {},
  }
}
