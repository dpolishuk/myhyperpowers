#!/usr/bin/env bun

import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { cwd, exit } from "node:process"
import * as p from "@clack/prompts"

import {
  AGENT_GROUPS,
  HYPERPOWERS_AGENTS,
  discoverAvailableModels,
  discoverOpencodeModels,
  planRecommendedRouting,
  verifyRecommendedRoutingPlan,
  writeRecommendedRoutingPlan,
} from "../.opencode/plugins/routing-wizard-core"

type ParsedArgs = {
  strongModel?: string
  fastModel?: string
  topReviewModel?: string
  yes: boolean
  help: boolean
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

const usage = `Usage:
  bun scripts/opencode-routing-wizard.ts [--strong-model provider/model] [--fast-model provider/model] [--top-review-model provider/model] [--yes]

What it does:
  - shells out to \`opencode models\` to discover live available provider/model ids
  - writes the canonical Hyperpowers routing split:
    - global agent mappings in opencode.json
    - workflow overrides in .opencode/hyperpowers-routing.json
  - verifies generated routing by reading it back through the shared routing backend
`

export const resolveSuggestedModels = async (rootDir: string, discoveredModels: string[]) => {
  const configPath = `${rootDir}/opencode.json`
  const hpConfigPath = `${rootDir}/.opencode/hyperpowers-routing.json`

  try {
    const parsed = existsSync(configPath) ? JSON.parse(await readFile(configPath, "utf8")) : { $schema: "https://opencode.ai/config.json" }
    const hpParsed = existsSync(hpConfigPath) ? JSON.parse(await readFile(hpConfigPath, "utf8")) : {}
    const configModels = discoverAvailableModels(parsed, hpParsed)
    return [...new Set([...discoveredModels, ...configModels])].sort()
  } catch {
    return [...new Set(discoveredModels)].sort()
  }
}

const resolveDefaultSelections = async (rootDir: string, suggestedModels: string[]) => {
  const configPath = `${rootDir}/opencode.json`
  const hpConfigPath = `${rootDir}/.opencode/hyperpowers-routing.json`

  try {
    const parsed = existsSync(configPath)
      ? JSON.parse(await readFile(configPath, "utf8"))
      : { $schema: "https://opencode.ai/config.json" }
    const hpParsed = existsSync(hpConfigPath) ? JSON.parse(await readFile(hpConfigPath, "utf8")) : {}

    const strongModel = getString(asRecord(parsed).model) ?? suggestedModels[0]
    const fastModel = getString(asRecord(parsed).small_model) ?? strongModel
    const workflowReviewer = asRecord(
      asRecord(asRecord(asRecord(hpParsed).workflowOverrides)["execute-ralph"])["autonomous-reviewer"],
    )
    const globalReviewer = asRecord(asRecord(asRecord(parsed).agent)["autonomous-reviewer"])
    const topReviewModel = getString(workflowReviewer.model) ?? getString(globalReviewer.model) ?? strongModel

    return { strongModel, fastModel, topReviewModel }
  } catch {
    return {
      strongModel: suggestedModels[0],
      fastModel: suggestedModels[0],
      topReviewModel: suggestedModels[0],
    }
  }
}

const requireValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1]
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value (e.g., ${flag} provider/model)`)
  }
  return value
}

const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = { yes: false, help: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case "--strong-model":
        parsed.strongModel = requireValue(argv, index, arg)
        index += 1
        break
      case "--fast-model":
        parsed.fastModel = requireValue(argv, index, arg)
        index += 1
        break
      case "--top-review-model":
        parsed.topReviewModel = requireValue(argv, index, arg)
        index += 1
        break
      case "--yes":
        parsed.yes = true
        break
      case "--help":
      case "-h":
        parsed.help = true
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return parsed
}

const getAgentGroup = (agent: string) => {
  if (AGENT_GROUPS.orchestrator.includes(agent as any)) return "orchestrator"
  if (AGENT_GROUPS.workers.includes(agent as any)) return "worker"
  if (AGENT_GROUPS.reviewers.includes(agent as any)) return "reviewer"
  return ""
}

const getCurrentRouting = async (rootDir: string) => {
  const configPath = `${rootDir}/opencode.json`
  try {
    const parsed = existsSync(configPath) ? JSON.parse(await readFile(configPath, "utf8")) : {}
    const agentMap = asRecord(asRecord(parsed).agent)
    const result: Record<string, string> = {}
    for (const agent of HYPERPOWERS_AGENTS) {
      result[agent] = getString(asRecord(agentMap[agent]).model) ?? getString(asRecord(parsed).model) ?? "(inherit)"
    }
    return result
  } catch {
    return {}
  }
}

const renderCurrentState = (routing: Record<string, string>) => {
  if (Object.keys(routing).length === 0) {
    p.log.warn("No routing config found. Run bootstrap to set up all agents.")
    return
  }

  const lines: string[] = []
  for (const [group, agents] of Object.entries(AGENT_GROUPS)) {
    lines.push(`  ${group}:`)
    for (const agent of agents) {
      const model = routing[agent] ?? "(not set)"
      lines.push(`    ${agent.padEnd(28)} ${model}`)
    }
  }
  p.note(lines.join("\n"), "Current Routing")
}

const renderPreview = (plan: ReturnType<typeof planRecommendedRouting>) => {
  const lines: string[] = []
  for (const [group, agents] of Object.entries(AGENT_GROUPS)) {
    lines.push(`  ${group}:`)
    for (const agent of agents) {
      lines.push(`    ${agent.padEnd(28)} ${plan.agent[agent].model}`)
    }
  }

  const overrides = Object.entries(plan.workflowOverrides)
  if (overrides.length > 0) {
    lines.push("")
    lines.push("  workflow overrides:")
    for (const [workflow, agents] of overrides) {
      for (const [agent, entry] of Object.entries(agents)) {
        lines.push(`    ${workflow}.${agent}: ${entry.model}`)
      }
    }
  }

  p.note(lines.join("\n"), "Planned Routing")
}

const modelOptions = (models: string[], currentModel?: string) =>
  models.map((m) => ({
    value: m,
    label: m,
    hint: m === currentModel ? "(current)" : undefined,
  }))

const ensureNotCancelled = <T>(value: T | symbol): T => {
  if (p.isCancel(value)) {
    p.cancel("Wizard cancelled.")
    exit(0)
  }
  return value as T
}

const selectModel = async (models: string[], message: string, currentModel?: string) => {
  // Use select with initial value for current model
  const initialValue = currentModel && models.includes(currentModel) ? currentModel : undefined
  return ensureNotCancelled(
    await p.select({
      message,
      options: modelOptions(models, currentModel),
      initialValue,
    }),
  )
}

const runBootstrapFlow = async (models: string[], defaults: { strongModel: string; fastModel: string; topReviewModel: string }) => {
  const strongModel = await selectModel(models, "Select strong model (orchestrator + reviewers)", defaults.strongModel)
  const fastModel = await selectModel(models, "Select fast model (workers — test-runner, investigators)", defaults.fastModel)
  const topReviewModel = await selectModel(models, "Select top-review model (autonomous-reviewer)", defaults.topReviewModel)
  return { strongModel, fastModel, topReviewModel }
}

const runSingleAgentFlow = async (models: string[], routing: Record<string, string>) => {
  const agent = ensureNotCancelled(
    await p.select({
      message: "Which agent?",
      options: HYPERPOWERS_AGENTS.map((a) => ({
        value: a,
        label: a,
        hint: `${getAgentGroup(a)} — ${routing[a] ?? "(not set)"}`,
      })),
    }),
  )

  const model = await selectModel(models, `Select model for ${agent}`, routing[agent])
  return { agent, model }
}

const main = async () => {
  let args: ParsedArgs
  try {
    args = parseArgs(Bun.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error(`\n${usage}`)
    exit(1)
    return
  }

  if (args.help) {
    console.log(usage)
    return
  }

  // --- Non-interactive mode (--yes) ---
  if (args.yes) {
    const discovery = await discoverOpencodeModels(undefined, cwd())
    if (!discovery.ok) {
      console.error(`Model discovery failed: ${discovery.error.message}`)
      exit(1)
      return
    }

    const suggestedModels = await resolveSuggestedModels(cwd(), discovery.models)
    const defaults = await resolveDefaultSelections(cwd(), suggestedModels)
    const strongModel = args.strongModel ?? defaults.strongModel
    const fastModel = args.fastModel ?? defaults.fastModel
    const topReviewModel = args.topReviewModel ?? defaults.topReviewModel

    if (!strongModel) {
      console.error("No strong model could be inferred from config or discovered models")
      exit(1)
      return
    }

    const plan = planRecommendedRouting({ strongModel, fastModel, topReviewModel })
    const writeResult = await writeRecommendedRoutingPlan(cwd(), plan)
    if (!writeResult.ok) {
      console.error(`Write failed: ${writeResult.error.message}`)
      exit(1)
      return
    }

    const verifyResult = await verifyRecommendedRoutingPlan(cwd(), plan, suggestedModels)
    if (!verifyResult.ok) {
      console.error(`Verification failed: ${verifyResult.error.message}`)
      exit(1)
      return
    }

    console.log("Routing config written and verified.")
    return
  }

  // --- Interactive TUI mode ---
  p.intro("Hyperpowers Routing Wizard")

  const s = p.spinner()
  s.start("Discovering available models...")

  const discovery = await discoverOpencodeModels(undefined, cwd())
  if (!discovery.ok) {
    s.stop("Model discovery failed")
    p.log.error(discovery.error.message)
    p.outro("Cannot continue without available models.")
    exit(1)
    return
  }

  const suggestedModels = await resolveSuggestedModels(cwd(), discovery.models)
  s.stop(`Found ${suggestedModels.length} available models`)

  let routing = await getCurrentRouting(cwd())
  renderCurrentState(routing)

  const defaults = await resolveDefaultSelections(cwd(), suggestedModels)

  // Main action loop
  let changed = false
  while (true) {
    const action = ensureNotCancelled(
      await p.select({
        message: "What would you like to do?",
        options: [
          { value: "bootstrap", label: "Bootstrap all agents", hint: "set strong + fast + review models" },
          { value: "single", label: "Configure single agent", hint: "pick agent → pick model" },
          { value: "preset", label: "Apply preset", hint: "cost-optimized or quality-first" },
          { value: "done", label: "Done", hint: changed ? "save and exit" : "exit without changes" },
        ],
      }),
    )

    if (action === "done") break

    if (action === "bootstrap") {
      const selections = await runBootstrapFlow(suggestedModels, defaults)
      const plan = planRecommendedRouting({
        strongModel: selections.strongModel,
        fastModel: selections.fastModel,
        topReviewModel: selections.topReviewModel,
      })

      renderPreview(plan)

      const confirmed = ensureNotCancelled(await p.confirm({ message: "Apply this routing?" }))
      if (!confirmed) continue

      s.start("Writing routing config...")
      const writeResult = await writeRecommendedRoutingPlan(cwd(), plan)
      if (!writeResult.ok) {
        s.stop("Write failed")
        p.log.error(writeResult.error.message)
        continue
      }

      const verifyResult = await verifyRecommendedRoutingPlan(cwd(), plan, suggestedModels)
      if (!verifyResult.ok) {
        s.stop("Verification failed")
        p.log.error(verifyResult.error.message)
        continue
      }

      s.stop("Routing config written and verified")
      changed = true

      // Refresh routing state for subsequent actions
      routing = await getCurrentRouting(cwd())
      renderCurrentState(routing)
    }

    if (action === "single") {
      const { agent, model } = await runSingleAgentFlow(suggestedModels, routing)

      // Use the shared core to write just this one agent
      const { executeRoutingAction } = await import("../.opencode/plugins/routing-wizard-core")
      const result = await executeRoutingAction(cwd(), { action: "set", agent, model })
      if ("ok" in result && result.ok) {
        routing[agent] = model
        p.log.success(`${agent} → ${model}`)
        changed = true
      } else {
        p.log.error(`Failed to update ${agent}`)
      }
    }

    if (action === "preset") {
      const preset = ensureNotCancelled(
        await p.select({
          message: "Which preset?",
          options: [
            {
              value: "cost-optimized",
              label: "Cost-optimized",
              hint: "workers=fast, reviewers=strong, autonomous-reviewer=top",
            },
            {
              value: "quality-first",
              label: "Quality-first",
              hint: "all agents=strong, autonomous-reviewer=top",
            },
          ],
        }),
      )

      // Presets need strong/fast/top models
      const selections = await runBootstrapFlow(suggestedModels, defaults)
      const plan = planRecommendedRouting({
        strongModel: selections.strongModel,
        fastModel: preset === "cost-optimized" ? selections.fastModel : selections.strongModel,
        topReviewModel: selections.topReviewModel,
      })

      renderPreview(plan)

      const confirmed = ensureNotCancelled(await p.confirm({ message: "Apply this preset?" }))
      if (!confirmed) continue

      s.start("Applying preset...")
      const writeResult = await writeRecommendedRoutingPlan(cwd(), plan)
      if (!writeResult.ok) {
        s.stop("Write failed")
        p.log.error(writeResult.error.message)
        continue
      }

      const verifyResult = await verifyRecommendedRoutingPlan(cwd(), plan, suggestedModels)
      if (!verifyResult.ok) {
        s.stop("Verification failed")
        p.log.error(verifyResult.error.message)
        continue
      }

      s.stop("Preset applied and verified")
      changed = true

      routing = await getCurrentRouting(cwd())
      renderCurrentState(routing)
    }
  }

  if (changed) {
    p.outro("Routing config saved. Restart OpenCode to apply.")
  } else {
    p.outro("No changes made.")
  }
}

if (import.meta.main) {
  await main()
}
