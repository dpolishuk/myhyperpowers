import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

const DEFAULT_SCHEMA = "https://opencode.ai/config.json"

export const HYPERPOWERS_AGENTS = [
  "autonomous-reviewer",
  "code-reviewer",
  "codebase-investigator",
  "internet-researcher",
  "ralph",
  "review-documentation",
  "review-implementation",
  "review-quality",
  "review-simplification",
  "review-testing",
  "test-effectiveness-analyst",
  "test-runner",
] as const

export const HYPERPOWERS_WORKFLOWS = [
  "analyzing-test-effectiveness",
  "brainstorming",
  "execute-plan",
  "execute-ralph",
  "fixing-bugs",
  "refactoring-safely",
  "review-documentation",
  "review-implementation",
  "review-quality",
  "review-simplification",
  "review-testing",
  "sre-task-refinement",
  "test-driven-development",
] as const

type AgentName = (typeof HYPERPOWERS_AGENTS)[number]
type WorkflowName = (typeof HYPERPOWERS_WORKFLOWS)[number]

export const AGENT_GROUPS = {
  orchestrator: ["ralph"] as AgentName[],
  workers: ["test-runner", "codebase-investigator", "internet-researcher"] as AgentName[],
  reviewers: [
    "autonomous-reviewer",
    "code-reviewer",
    "review-quality",
    "review-implementation",
    "review-testing",
    "review-simplification",
    "review-documentation",
    "test-effectiveness-analyst",
  ] as AgentName[],
} as const

type GroupName = keyof typeof AGENT_GROUPS | "all"

export const PRESET_NAMES = ["cost-optimized", "quality-first"] as const
type PresetName = (typeof PRESET_NAMES)[number]

type RoutingEntry = Record<string, unknown> & {
  model?: string
}

type OpenCodeConfig = Record<string, unknown> & {
  $schema?: string
  model?: string
  agent?: Record<string, RoutingEntry>
}

type HyperpowersRoutingConfig = {
  workflowOverrides?: Record<string, Record<string, RoutingEntry>>
}

type RoutingToolArgs = {
  action: "get" | "set" | "set-group" | "apply-preset"
  agent?: string
  workflow?: string
  model?: string
  group?: string
  preset?: string
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

const getString = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeName = (value: string) => value.trim().toLowerCase()

const sortObject = <T>(record: Record<string, T>) => {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b))) as Record<string, T>
}

const canonicalize = <T extends readonly string[]>(value: string | undefined, supported: T) => {
  const raw = getString(value)
  if (!raw) return null
  const normalized = normalizeName(raw)
  return supported.find((entry) => normalizeName(entry) === normalized) ?? null
}

const invalidResult = (configPath: string, code: string, message: string, extra: Record<string, unknown> = {}) => ({
  ok: false,
  error: {
    code,
    message,
    configPath,
    ...extra,
  },
})

const normalizeAgentMap = (value: unknown) => {
  const input = asRecord(value)
  const result: Record<string, RoutingEntry> = {}

  for (const agentName of HYPERPOWERS_AGENTS) {
    const entry = asRecord(input[agentName])
    if (Object.keys(entry).length === 0) continue
    result[agentName] = entry
  }

  return sortObject(result)
}

const normalizeWorkflowOverrides = (value: unknown) => {
  const input = asRecord(value)
  const result: Record<string, Record<string, RoutingEntry>> = {}

  for (const workflowName of HYPERPOWERS_WORKFLOWS) {
    const workflowEntry = asRecord(input[workflowName])
    if (Object.keys(workflowEntry).length === 0) continue

    const agentEntries: Record<string, RoutingEntry> = {}
    for (const agentName of HYPERPOWERS_AGENTS) {
      const entry = asRecord(workflowEntry[agentName])
      if (Object.keys(entry).length === 0) continue
      agentEntries[agentName] = entry
    }

    if (Object.keys(agentEntries).length > 0) {
      result[workflowName] = sortObject(agentEntries)
    }
  }

  return sortObject(result)
}

const discoverModels = (config: OpenCodeConfig): string[] => {
  const models = new Set<string>()

  const addIfModel = (value: unknown) => {
    const model = getString(value)
    if (model && model.includes("/")) models.add(model)
  }

  addIfModel(config.model)
  addIfModel((config as Record<string, unknown>).small_model)

  const agentMap = asRecord(config.agent)
  for (const entry of Object.values(agentMap)) {
    addIfModel(asRecord(entry).model)
  }

  const providers = asRecord((config as Record<string, unknown>).provider)
  for (const [providerId, providerValue] of Object.entries(providers)) {
    const providerObj = asRecord(providerValue)
    const providerModels = asRecord(providerObj.models)
    for (const modelId of Object.keys(providerModels)) {
      models.add(`${providerId}/${modelId}`)
    }
  }

  return [...models].sort()
}

const createRoutingSnapshot = (
  config: OpenCodeConfig,
  hpConfig: HyperpowersRoutingConfig,
  configPath: string,
  hpConfigPath: string,
) => ({
  ok: true,
  sourceOfTruth: ["opencode.json", ".opencode/hyperpowers-routing.json"],
  configPath,
  hpConfigPath,
  supportedAgents: [...HYPERPOWERS_AGENTS],
  supportedWorkflows: [...HYPERPOWERS_WORKFLOWS],
  agentGroups: {
    orchestrator: [...AGENT_GROUPS.orchestrator],
    workers: [...AGENT_GROUPS.workers],
    reviewers: [...AGENT_GROUPS.reviewers],
  },
  availableModels: discoverModels(config),
  presets: [...PRESET_NAMES],
  routing: {
    model: getString(config.model),
    agent: normalizeAgentMap(config.agent),
    workflowOverrides: normalizeWorkflowOverrides(hpConfig.workflowOverrides),
  },
})

const readConfig = async (configPath: string) => {
  if (!existsSync(configPath)) {
    return invalidResult(configPath, "config_not_found", "No opencode.json file was found for this project")
  }

  try {
    const raw = await readFile(configPath, "utf8")
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return invalidResult(configPath, "invalid_json", "opencode.json must contain a JSON object")
    }
    return {
      ok: true as const,
      config: parsed as OpenCodeConfig,
      createdConfig: false,
    }
  } catch (error) {
    return invalidResult(
      configPath,
      "invalid_json",
      error instanceof Error ? error.message : "Failed to parse opencode.json",
    )
  }
}

const loadConfigForWrite = async (configPath: string) => {
  if (!existsSync(configPath)) {
    return {
      ok: true as const,
      config: { $schema: DEFAULT_SCHEMA } as OpenCodeConfig,
      createdConfig: true,
    }
  }
  return readConfig(configPath)
}

const persistConfig = async (configPath: string, config: Record<string, unknown>) => {
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

const readHpConfig = async (hpConfigPath: string): Promise<HyperpowersRoutingConfig> => {
  if (!existsSync(hpConfigPath)) return {}
  try {
    const raw = await readFile(hpConfigPath, "utf8")
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return parsed as HyperpowersRoutingConfig
  } catch {
    return {}
  }
}

const updateGlobalAgentModel = (config: OpenCodeConfig, agentName: AgentName, model: string) => {
  const nextConfig: OpenCodeConfig = { ...config }
  const existingAgentMap = asRecord(nextConfig.agent)
  const existingEntry = asRecord(existingAgentMap[agentName])

  nextConfig.agent = sortObject({
    ...existingAgentMap,
    [agentName]: {
      ...existingEntry,
      model,
    },
  }) as Record<string, RoutingEntry>

  return nextConfig
}

const updateWorkflowAgentModel = (
  hpConfig: HyperpowersRoutingConfig,
  workflowName: WorkflowName,
  agentName: AgentName,
  model: string,
): HyperpowersRoutingConfig => {
  const workflowOverrides = asRecord(hpConfig.workflowOverrides)
  const workflowEntry = asRecord(workflowOverrides[workflowName])
  const agentEntry = asRecord(workflowEntry[agentName])

  return {
    ...hpConfig,
    workflowOverrides: sortObject({
      ...workflowOverrides,
      [workflowName]: sortObject({
        ...workflowEntry,
        [agentName]: {
          ...agentEntry,
          model,
        },
      }),
    }),
  }
}

const resolveGroupAgents = (groupName: string): AgentName[] | null => {
  if (groupName === "all") return [...HYPERPOWERS_AGENTS]
  const group = AGENT_GROUPS[groupName as keyof typeof AGENT_GROUPS]
  return group ? [...group] : null
}

const applyPreset = (
  config: OpenCodeConfig,
  presetName: PresetName,
): { config: OpenCodeConfig; updatedAgents: AgentName[] } => {
  const strongModel = getString(config.model) ?? "default/model"
  const fastModel = getString((config as Record<string, unknown>).small_model) ?? strongModel

  let nextConfig = { ...config }
  const updatedAgents: AgentName[] = []

  const assign = (agents: readonly AgentName[], model: string) => {
    for (const agent of agents) {
      nextConfig = updateGlobalAgentModel(nextConfig, agent, model)
      updatedAgents.push(agent)
    }
  }

  switch (presetName) {
    case "cost-optimized":
      assign(AGENT_GROUPS.orchestrator, strongModel)
      assign(AGENT_GROUPS.workers, fastModel)
      assign(AGENT_GROUPS.reviewers, strongModel)
      break
    case "quality-first":
      assign(HYPERPOWERS_AGENTS, strongModel)
      break
  }

  return { config: nextConfig, updatedAgents }
}

const executeRoutingAction = async (rootDir: string, args: RoutingToolArgs) => {
  const configPath = join(rootDir, "opencode.json")
  const hpConfigPath = join(rootDir, ".opencode", "hyperpowers-routing.json")

  if (args.action === "get") {
    const current = await readConfig(configPath)
    if (!current.ok) return current
    const hpConfig = await readHpConfig(hpConfigPath)
    return createRoutingSnapshot(current.config, hpConfig, configPath, hpConfigPath)
  }

  if (args.action === "set-group") {
    const groupName = getString(args.group)
    if (!groupName) {
      return invalidResult(configPath, "missing_group", "Provide a group name: orchestrator, workers, reviewers, or all")
    }
    const agents = resolveGroupAgents(groupName)
    if (!agents) {
      return invalidResult(configPath, "unsupported_group", "Use a supported group name", {
        supportedGroups: ["orchestrator", "workers", "reviewers", "all"],
      })
    }
    const model = getString(args.model)
    if (!model) {
      return invalidResult(configPath, "missing_model", "Provide a non-empty model in provider/model format")
    }

    const current = await loadConfigForWrite(configPath)
    if (!current.ok) return current

    let nextConfig = current.config
    for (const agent of agents) {
      nextConfig = updateGlobalAgentModel(nextConfig, agent, model)
    }
    await persistConfig(configPath, nextConfig)

    const hpConfig = await readHpConfig(hpConfigPath)
    return {
      ...createRoutingSnapshot(nextConfig, hpConfig, configPath, hpConfigPath),
      updatedAgents: agents,
      updatedFile: "opencode.json",
    }
  }

  if (args.action === "apply-preset") {
    const presetName = getString(args.preset)
    if (!presetName || !PRESET_NAMES.includes(presetName as PresetName)) {
      return invalidResult(configPath, "unsupported_preset", "Use a supported preset name", {
        supportedPresets: [...PRESET_NAMES],
      })
    }

    const current = await readConfig(configPath)
    if (!current.ok) return current

    const { config: nextConfig, updatedAgents } = applyPreset(current.config, presetName as PresetName)
    await persistConfig(configPath, nextConfig)

    const hpConfig = await readHpConfig(hpConfigPath)
    return {
      ...createRoutingSnapshot(nextConfig, hpConfig, configPath, hpConfigPath),
      appliedPreset: presetName,
      updatedAgents,
      updatedFile: "opencode.json",
    }
  }

  const agentName = canonicalize(args.agent, HYPERPOWERS_AGENTS)
  if (!agentName) {
    return invalidResult(configPath, "unsupported_agent", "Use a concrete Hyperpowers agent name", {
      supportedAgents: [...HYPERPOWERS_AGENTS],
    })
  }

  const model = getString(args.model)
  if (!model) {
    return invalidResult(configPath, "missing_model", "Provide a non-empty model in provider/model format")
  }

  const workflowName = args.workflow ? canonicalize(args.workflow, HYPERPOWERS_WORKFLOWS) : null
  if (args.workflow && !workflowName) {
    return invalidResult(configPath, "unsupported_workflow", "Use a supported Hyperpowers workflow name", {
      supportedWorkflows: [...HYPERPOWERS_WORKFLOWS],
    })
  }

  if (workflowName) {
    const hpConfig = await readHpConfig(hpConfigPath)
    const nextHpConfig = updateWorkflowAgentModel(hpConfig, workflowName, agentName, model)
    await persistConfig(hpConfigPath, nextHpConfig)

    const current = await readConfig(configPath)
    const ocConfig = current.ok ? current.config : ({} as OpenCodeConfig)
    return {
      ...createRoutingSnapshot(ocConfig, nextHpConfig, configPath, hpConfigPath),
      updatedPath: `workflowOverrides.${workflowName}.${agentName}.model`,
      updatedFile: ".opencode/hyperpowers-routing.json",
    }
  }

  const current = await loadConfigForWrite(configPath)
  if (!current.ok) return current

  const nextConfig = updateGlobalAgentModel(current.config, agentName, model)
  await persistConfig(configPath, nextConfig)

  const hpConfig = await readHpConfig(hpConfigPath)
  return {
    ...createRoutingSnapshot(nextConfig, hpConfig, configPath, hpConfigPath),
    createdConfig: current.createdConfig,
    updatedPath: `agent.${agentName}.model`,
    updatedFile: "opencode.json",
  }
}

const agentRoutingConfigPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      hyperpowers_agent_routing_config: tool({
        description:
          "Read or update the shared Hyperpowers agent-model routing map. Agent mappings live in opencode.json; workflow overrides live in .opencode/hyperpowers-routing.json.",
        args: {
          action: tool.schema
            .enum(["get", "set", "set-group", "apply-preset"])
            .describe("Action: get (read), set (single agent), set-group (batch), apply-preset (profile)"),
          agent: tool.schema.string().optional().describe("Concrete Hyperpowers agent name (for set)"),
          workflow: tool.schema.string().optional().describe("Optional workflow override name (for set)"),
          model: tool.schema.string().optional().describe("Provider/model value (for set, set-group)"),
          group: tool.schema.string().optional().describe("Agent group: orchestrator, workers, reviewers, all (for set-group)"),
          preset: tool.schema.string().optional().describe("Preset profile: cost-optimized, quality-first (for apply-preset)"),
        },
        async execute(args) {
          const result = await executeRoutingAction(ctx.directory, args as RoutingToolArgs)
          return JSON.stringify(result, null, 2)
        },
      }),
    },
  }
}

export { executeRoutingAction }
export default agentRoutingConfigPlugin
