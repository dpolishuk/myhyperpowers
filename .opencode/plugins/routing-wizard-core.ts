import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export const DEFAULT_SCHEMA = "https://opencode.ai/config.json"

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

export type AgentName = (typeof HYPERPOWERS_AGENTS)[number]
export type WorkflowName = (typeof HYPERPOWERS_WORKFLOWS)[number]

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

export const PRESET_NAMES = ["cost-optimized", "quality-first"] as const

type PresetName = (typeof PRESET_NAMES)[number]
type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

export type ModelsCommandRunner = (cwd: string) => Promise<CommandResult>

export type RoutingEntry = Record<string, unknown> & {
  model?: string
}

export type OpenCodeConfig = Record<string, unknown> & {
  $schema?: string
  model?: string
  agent?: Record<string, RoutingEntry>
}

export type HyperpowersRoutingConfig = {
  workflowOverrides?: Record<string, Record<string, RoutingEntry>>
}

export type RoutingToolArgs = {
  action: "get" | "set" | "set-group" | "apply-preset" | "bootstrap"
  agent?: string
  workflow?: string
  model?: string
  group?: string
  preset?: string
  strongModel?: string
  fastModel?: string
  topReviewModel?: string
}

export type RecommendedRoutingPlan = {
  model: string
  smallModel?: string
  agent: Record<string, RoutingEntry>
  workflowOverrides: Record<string, Record<string, RoutingEntry>>
  selectedModels: string[]
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
  ok: false as const,
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

export const discoverModelsFromConfig = (config: OpenCodeConfig): string[] => {
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

export const discoverModelsFromWorkflowOverrides = (hpConfig: HyperpowersRoutingConfig): string[] => {
  const models = new Set<string>()

  const workflowOverrides = asRecord(hpConfig.workflowOverrides)
  for (const workflow of Object.values(workflowOverrides)) {
    const workflowAgents = asRecord(workflow)
    for (const entry of Object.values(workflowAgents)) {
      const model = getString(asRecord(entry).model)
      if (model && model.includes("/")) {
        models.add(model)
      }
    }
  }

  return [...models].sort()
}

export const discoverAvailableModels = (config: OpenCodeConfig, hpConfig: HyperpowersRoutingConfig) => {
  return [...new Set([...discoverModelsFromConfig(config), ...discoverModelsFromWorkflowOverrides(hpConfig)])].sort()
}

export const createRoutingSnapshot = (
  config: OpenCodeConfig,
  hpConfig: HyperpowersRoutingConfig,
  configPath: string,
  hpConfigPath: string,
  options: {
    availableModels?: string[]
    configMissing?: boolean
  } = {},
) => ({
  ok: true as const,
  sourceOfTruth: ["opencode.json", ".opencode/hyperpowers-routing.json"],
  configPath,
  hpConfigPath,
  configMissing: options.configMissing ?? false,
  supportedAgents: [...HYPERPOWERS_AGENTS],
  supportedWorkflows: [...HYPERPOWERS_WORKFLOWS],
  agentGroups: {
    orchestrator: [...AGENT_GROUPS.orchestrator],
    workers: [...AGENT_GROUPS.workers],
    reviewers: [...AGENT_GROUPS.reviewers],
  },
  availableModels: [...new Set([...discoverAvailableModels(config, hpConfig), ...(options.availableModels ?? [])])].sort(),
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

const readOptionalFile = async (filePath: string) => {
  if (!existsSync(filePath)) return null
  return readFile(filePath, "utf8")
}

const restoreOptionalFile = async (filePath: string, contents: string | null) => {
  if (contents === null) {
    if (existsSync(filePath)) {
      await writeFile(filePath, "", "utf8")
    }
    return
  }

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, "utf8")
}

const removeIfEmptyFile = async (filePath: string) => {
  if (!existsSync(filePath)) return
  const contents = await readFile(filePath, "utf8")
  if (contents.length === 0) {
    const { unlink } = await import("node:fs/promises")
    await unlink(filePath)
  }
}

const readHpConfig = async (
  hpConfigPath: string,
  strict = false,
): Promise<HyperpowersRoutingConfig | { ok: false; error: Record<string, unknown> }> => {
  if (!existsSync(hpConfigPath)) return {}
  try {
    const raw = await readFile(hpConfigPath, "utf8")
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      if (!strict) return {}
      return {
        ok: false,
        error: {
          code: "invalid_hp_json",
          message: ".opencode/hyperpowers-routing.json must contain a JSON object",
          configPath: hpConfigPath,
        },
      }
    }
    return parsed as HyperpowersRoutingConfig
  } catch (error) {
    if (!strict) return {}
    return {
      ok: false,
      error: {
        code: "invalid_hp_json",
        message: error instanceof Error ? error.message : "Failed to parse .opencode/hyperpowers-routing.json",
        configPath: hpConfigPath,
      },
    }
  }
}

const readHpConfigForWrite = async (
  hpConfigPath: string,
  errorPath = hpConfigPath,
): Promise<{ ok: true; config: HyperpowersRoutingConfig } | { ok: false; error: Record<string, unknown> }> => {
  if (!existsSync(hpConfigPath)) return { ok: true, config: {} }
  try {
    const raw = await readFile(hpConfigPath, "utf8")
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        error: {
          code: "invalid_hp_json",
          message: ".opencode/hyperpowers-routing.json must contain a JSON object",
          configPath: errorPath,
        },
      }
    }
    return { ok: true, config: parsed as HyperpowersRoutingConfig }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "invalid_hp_json",
        message: error instanceof Error ? error.message : "Failed to parse .opencode/hyperpowers-routing.json",
        configPath: errorPath,
      },
    }
  }
}

export const updateGlobalAgentModel = (config: OpenCodeConfig, agentName: AgentName, model: string) => {
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

export const updateWorkflowAgentModel = (
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
): { ok: true; config: OpenCodeConfig; updatedAgents: AgentName[] } | { ok: false; code: string; message: string } => {
  const strongModel = getString(config.model)
  if (!strongModel) {
    return {
      ok: false,
      code: "missing_model",
      message: "opencode.json must have a top-level model before applying a preset",
    }
  }
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

  return { ok: true, config: nextConfig, updatedAgents }
}

const runOpencodeModels = async (cwd: string): Promise<CommandResult> => {
  return new Promise((resolve, reject) => {
    const child = spawn("opencode", ["models"], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    child.on("error", (error) => reject(error))
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      })
    })
  })
}

export const parseOpencodeModelsOutput = (output: string) => {
  const models = new Set<string>()

  for (const line of output.split(/\r?\n/)) {
    const matches = line.match(/[A-Za-z0-9._-]+\/[A-Za-z0-9._:-]+/g)
    if (!matches) continue

    for (const match of matches) {
      models.add(match.trim())
    }
  }

  return [...models].sort()
}

export const discoverOpencodeModels = async (runner: ModelsCommandRunner = runOpencodeModels, cwd = process.cwd()) => {
  try {
    const result = await runner(cwd)
    if (result.exitCode !== 0) {
      return {
        ok: false as const,
        error: {
          code: "opencode_models_failed",
          message: "`opencode models` failed; verify OpenCode is installed and configured",
          stderr: result.stderr.trim(),
        },
      }
    }

    const models = parseOpencodeModelsOutput(result.stdout)
    if (models.length === 0) {
      return {
        ok: false as const,
        error: {
          code: "no_models_found",
          message: "`opencode models` returned no usable provider/model ids",
        },
      }
    }

    return {
      ok: true as const,
      models,
      source: "opencode models",
    }
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : null
    return {
      ok: false as const,
      error: {
        code: errorCode === "ENOENT" ? "missing_opencode_cli" : "opencode_models_failed",
        message:
          errorCode === "ENOENT"
            ? "`opencode` CLI was not found in PATH; install OpenCode or fix your PATH before running the wizard"
            : error instanceof Error
              ? error.message
              : "Failed to execute `opencode models`",
      },
    }
  }
}

const validateModelAgainstAvailableSet = (
  configPath: string,
  model: string,
  allowedModels: string[],
) => {
  if (allowedModels.includes(model)) return null

  return invalidResult(configPath, "invalid_selected_model", `Selected model not found in discovered model list: ${model}`, {
    model,
    discoveredModels: allowedModels,
  })
}

export const planRecommendedRouting = ({
  strongModel,
  fastModel,
  topReviewModel,
}: {
  strongModel: string
  fastModel?: string
  topReviewModel?: string
}) => {
  const canonicalStrong = getString(strongModel)
  if (!canonicalStrong) {
    throw new Error("strongModel must be a non-empty provider/model string")
  }

  const configuredFastModel = getString(fastModel)
  const configuredTopReviewModel = getString(topReviewModel)
  const resolvedFastModel = configuredFastModel ?? canonicalStrong
  const resolvedTopReviewModel = configuredTopReviewModel ?? canonicalStrong

  let nextConfig: OpenCodeConfig = {
    $schema: DEFAULT_SCHEMA,
    model: canonicalStrong,
  }
  if (configuredFastModel && configuredFastModel !== canonicalStrong) {
    ;(nextConfig as Record<string, unknown>).small_model = configuredFastModel
  }

  for (const agent of AGENT_GROUPS.orchestrator) {
    nextConfig = updateGlobalAgentModel(nextConfig, agent, canonicalStrong)
  }

  for (const agent of AGENT_GROUPS.workers) {
    nextConfig = updateGlobalAgentModel(nextConfig, agent, resolvedFastModel)
  }

  for (const agent of AGENT_GROUPS.reviewers) {
    nextConfig = updateGlobalAgentModel(nextConfig, agent, canonicalStrong)
  }

  nextConfig = updateGlobalAgentModel(nextConfig, "autonomous-reviewer", resolvedTopReviewModel)

  const workflowOverrides = normalizeWorkflowOverrides({
    "execute-ralph": {
      "autonomous-reviewer": {
        model: resolvedTopReviewModel,
      },
    },
  })

  return {
    model: canonicalStrong,
    smallModel: configuredFastModel,
    agent: normalizeAgentMap(nextConfig.agent),
    workflowOverrides,
    selectedModels: [...new Set([canonicalStrong, resolvedFastModel, resolvedTopReviewModel])].sort(),
  } satisfies RecommendedRoutingPlan
}

export const writeRecommendedRoutingPlan = async (rootDir: string, plan: RecommendedRoutingPlan) => {
  const configPath = join(rootDir, "opencode.json")
  const hpConfigPath = join(rootDir, ".opencode", "hyperpowers-routing.json")

  const current = await loadConfigForWrite(configPath)
  if (!current.ok) return current

  let nextConfig: OpenCodeConfig = {
    ...current.config,
    $schema: current.config.$schema ?? DEFAULT_SCHEMA,
    model: plan.model,
  }

  const mutableConfig = nextConfig as Record<string, unknown>
  if (plan.smallModel && plan.smallModel !== plan.model) {
    mutableConfig.small_model = plan.smallModel
  } else {
    delete mutableConfig.small_model
  }

  for (const agentName of HYPERPOWERS_AGENTS) {
    const model = getString(asRecord(plan.agent)[agentName]?.model)
    if (!model) continue
    nextConfig = updateGlobalAgentModel(nextConfig, agentName, model)
  }

  const hpResult = await readHpConfigForWrite(hpConfigPath, configPath)
  if (!hpResult.ok) {
    return { ok: false as const, error: hpResult.error }
  }

  let nextHpConfig = hpResult.config
  for (const workflowName of Object.keys(plan.workflowOverrides)) {
    const canonicalWorkflow = canonicalize(workflowName, HYPERPOWERS_WORKFLOWS)
    if (!canonicalWorkflow) continue

    const workflowAgents = asRecord(plan.workflowOverrides[canonicalWorkflow])
    for (const agentName of HYPERPOWERS_AGENTS) {
      const model = getString(asRecord(workflowAgents[agentName]).model)
      if (!model) continue
      nextHpConfig = updateWorkflowAgentModel(nextHpConfig, canonicalWorkflow, agentName, model)
    }
  }

  await persistConfig(configPath, nextConfig)
  await persistConfig(hpConfigPath, nextHpConfig as Record<string, unknown>)

  return {
    ok: true as const,
    configPath,
    hpConfigPath,
    createdConfig: current.createdConfig,
  }
}

export const verifyRecommendedRoutingPlan = async (
  rootDir: string,
  plan: RecommendedRoutingPlan,
  discoveredModels: string[],
) => {
  const configPath = join(rootDir, "opencode.json")
  const hpConfigPath = join(rootDir, ".opencode", "hyperpowers-routing.json")

  for (const model of plan.selectedModels) {
    if (!discoveredModels.includes(model)) {
      return invalidResult(configPath, "invalid_selected_model", `Selected model not found in discovered model list: ${model}`, {
        model,
        discoveredModels,
      })
    }
  }

  const current = await readConfig(configPath)
  if (!current.ok) return current

  const hpResult = await readHpConfigForWrite(hpConfigPath, configPath)
  if (!hpResult.ok) {
    return { ok: false as const, error: hpResult.error }
  }

  const persistedSmallModel = getString((current.config as Record<string, unknown>).small_model)
  const expectedSmallModel = plan.smallModel && plan.smallModel !== plan.model ? plan.smallModel : null
  if ((persistedSmallModel ?? null) !== expectedSmallModel) {
    return invalidResult(configPath, "snapshot_mismatch", "Persisted small_model does not match the planned wizard output", {
      expected: expectedSmallModel,
      actual: persistedSmallModel,
    })
  }

  const snapshot = await executeRoutingAction(rootDir, { action: "get" })
  if (!snapshot.ok) return snapshot

  if (snapshot.routing.model !== plan.model) {
    return invalidResult(configPath, "snapshot_mismatch", "Top-level model in routing snapshot does not match the plan", {
      expected: plan.model,
      actual: snapshot.routing.model,
    })
  }

  for (const agentName of HYPERPOWERS_AGENTS) {
    const expectedModel = getString(asRecord(plan.agent)[agentName]?.model)
    const actualModel = getString(asRecord(snapshot.routing.agent)[agentName]?.model)
    if ((expectedModel ?? null) !== (actualModel ?? null)) {
      return invalidResult(configPath, "snapshot_mismatch", `Routing snapshot diverged for agent ${agentName}`, {
        agent: agentName,
        expected: expectedModel,
        actual: actualModel,
      })
    }
  }

  for (const workflowName of Object.keys(plan.workflowOverrides)) {
    const expectedAgents = asRecord(plan.workflowOverrides[workflowName])
    const actualAgents = asRecord(snapshot.routing.workflowOverrides[workflowName])
    for (const agentName of Object.keys(expectedAgents)) {
      const expectedModel = getString(asRecord(expectedAgents[agentName]).model)
      const actualModel = getString(asRecord(actualAgents[agentName]).model)
      if ((expectedModel ?? null) !== (actualModel ?? null)) {
        return invalidResult(configPath, "snapshot_mismatch", `Workflow override diverged for ${workflowName}/${agentName}`, {
          workflow: workflowName,
          agent: agentName,
          expected: expectedModel,
          actual: actualModel,
        })
      }
    }
  }

  return {
    ok: true as const,
    snapshot,
  }
}

export const executeRoutingAction = async (rootDir: string, args: RoutingToolArgs) => {
  const configPath = join(rootDir, "opencode.json")
  const hpConfigPath = join(rootDir, ".opencode", "hyperpowers-routing.json")
  const loadStrictHpConfig = async () => {
    const hpResult = await readHpConfigForWrite(hpConfigPath)
    if (!hpResult.ok) return hpResult
    return hpResult.config
  }
  const loadHpConfigWarning = async () => {
    const hpResult = await readHpConfigForWrite(hpConfigPath)
    if (!hpResult.ok) {
      return {
        config: {} as HyperpowersRoutingConfig,
        warning: hpResult.error,
      }
    }
    return {
      config: hpResult.config,
      warning: null as Record<string, unknown> | null,
    }
  }

  if (args.action === "get") {
    const current = await readConfig(configPath)
    const discovered = await discoverOpencodeModels(undefined, rootDir)
    const discoveredModels = discovered.ok ? discovered.models : []
    const hpState = await loadHpConfigWarning()

    if (!current.ok) {
      if (current.error.code !== "config_not_found" || !discovered.ok) return current
      return {
        ...createRoutingSnapshot({ $schema: DEFAULT_SCHEMA }, hpState.config, configPath, hpConfigPath, {
          availableModels: discoveredModels,
          configMissing: true,
        }),
        ...(hpState.warning ? { warning: hpState.warning } : {}),
      }
    }

    return {
      ...createRoutingSnapshot(current.config, hpState.config, configPath, hpConfigPath, {
        availableModels: discoveredModels,
      }),
      ...(hpState.warning ? { warning: hpState.warning } : {}),
    }
  }

  if (args.action === "bootstrap") {
    const discovery = await discoverOpencodeModels(undefined, rootDir)
    if (!discovery.ok) {
      return invalidResult(configPath, discovery.error.code, discovery.error.message, {
        stderr: discovery.error.stderr,
      })
    }

    const strongModel = getString(args.strongModel)
    if (!strongModel) {
      return invalidResult(configPath, "missing_model", "Provide a non-empty strongModel in provider/model format")
    }

    const hpResult = await readHpConfigForWrite(hpConfigPath)
    if (!hpResult.ok) {
      return { ok: false as const, error: hpResult.error }
    }
    const current = await loadConfigForWrite(configPath)
    if (!current.ok && current.error.code !== "config_not_found") return current
    const availableModels = [...new Set([...discovery.models, ...discoverAvailableModels(current.ok ? current.config : { $schema: DEFAULT_SCHEMA }, hpResult.config)])].sort()

    const strongModelValidation = validateModelAgainstAvailableSet(configPath, strongModel, availableModels)
    if (strongModelValidation) return strongModelValidation

    const fastModel = getString(args.fastModel) ?? undefined
    if (fastModel) {
      const fastModelValidation = validateModelAgainstAvailableSet(configPath, fastModel, availableModels)
      if (fastModelValidation) return fastModelValidation
    }

    const topReviewModel = getString(args.topReviewModel) ?? undefined
    if (topReviewModel) {
      const topReviewValidation = validateModelAgainstAvailableSet(configPath, topReviewModel, availableModels)
      if (topReviewValidation) return topReviewValidation
    }

    const plan = planRecommendedRouting({
      strongModel,
      fastModel,
      topReviewModel,
    })

    const originalConfigContents = await readOptionalFile(configPath)
    const originalHpContents = await readOptionalFile(hpConfigPath)

    const writeResult = await writeRecommendedRoutingPlan(rootDir, plan)
    if (!writeResult.ok) return writeResult

    const verifyResult = await verifyRecommendedRoutingPlan(rootDir, plan, availableModels)
    if (!verifyResult.ok) {
      await restoreOptionalFile(configPath, originalConfigContents)
      await removeIfEmptyFile(configPath)
      await restoreOptionalFile(hpConfigPath, originalHpContents)
      await removeIfEmptyFile(hpConfigPath)
      return verifyResult
    }

    return {
      ...verifyResult.snapshot,
      bootstrapApplied: true,
      createdConfig: writeResult.createdConfig,
      updatedFiles: ["opencode.json", ".opencode/hyperpowers-routing.json"],
    }
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

    const discovery = await discoverOpencodeModels(undefined, rootDir)
    const current = await loadConfigForWrite(configPath)
    if (!current.ok) return current
    const hpState = await loadHpConfigWarning()
    const availableModels = [...new Set([...discovery.ok ? discovery.models : [], ...discoverAvailableModels(current.config, hpState.config)])].sort()
    const invalidModel = validateModelAgainstAvailableSet(configPath, model, availableModels)
    if (invalidModel) return invalidModel

    let nextConfig = current.config
    for (const agent of agents) {
      nextConfig = updateGlobalAgentModel(nextConfig, agent, model)
    }
    await persistConfig(configPath, nextConfig)

    const hpConfig = hpState.config
    return {
      ...createRoutingSnapshot(nextConfig, hpConfig, configPath, hpConfigPath),
      updatedAgents: agents,
      updatedFile: "opencode.json",
      ...(hpState.warning ? { warning: hpState.warning } : {}),
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
    const hpState = await loadHpConfigWarning()

    const presetResult = applyPreset(current.config, presetName as PresetName)
    if (!presetResult.ok) {
      return invalidResult(configPath, presetResult.code, presetResult.message)
    }
    const { config: nextConfig, updatedAgents } = presetResult
    await persistConfig(configPath, nextConfig)

    const hpConfig = hpState.config
    return {
      ...createRoutingSnapshot(nextConfig, hpConfig, configPath, hpConfigPath),
      appliedPreset: presetName,
      updatedAgents,
      updatedFile: "opencode.json",
      ...(hpState.warning ? { warning: hpState.warning } : {}),
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

  const discovery = await discoverOpencodeModels(undefined, rootDir)
  const current = await loadConfigForWrite(configPath)
  if (!current.ok) return current
  const hpState = workflowName ? await loadStrictHpConfig() : await loadHpConfigWarning()
  if ("ok" in hpState && hpState.ok === false) return hpState
  const availableModels = [
    ...new Set([
      ...(discovery.ok ? discovery.models : []),
      ...discoverAvailableModels(current.config, ("config" in hpState ? hpState.config : hpState) as HyperpowersRoutingConfig),
    ]),
  ].sort()
  const invalidModel = validateModelAgainstAvailableSet(configPath, model, availableModels)
  if (invalidModel) return invalidModel

  if (workflowName) {
    const hpResult = await readHpConfigForWrite(hpConfigPath)
    if (!hpResult.ok) {
      return { ok: false as const, error: hpResult.error }
    }
    const nextHpConfig = updateWorkflowAgentModel(hpResult.config, workflowName, agentName, model)
    await persistConfig(hpConfigPath, nextHpConfig as Record<string, unknown>)

    const current = await readConfig(configPath)
    const ocConfig = current.ok ? current.config : ({ $schema: DEFAULT_SCHEMA } as OpenCodeConfig)
    return {
      ...createRoutingSnapshot(ocConfig, nextHpConfig, configPath, hpConfigPath),
      updatedPath: `workflowOverrides.${workflowName}.${agentName}.model`,
      updatedFile: ".opencode/hyperpowers-routing.json",
    }
  }

  const nextConfig = updateGlobalAgentModel(current.config, agentName, model)
  await persistConfig(configPath, nextConfig)

  const hpConfig = hpState.config
  return {
    ...createRoutingSnapshot(nextConfig, hpConfig, configPath, hpConfigPath),
    createdConfig: current.createdConfig,
    updatedPath: `agent.${agentName}.model`,
    updatedFile: "opencode.json",
    ...(hpState.warning ? { warning: hpState.warning } : {}),
  }
}
