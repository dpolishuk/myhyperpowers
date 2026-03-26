#!/usr/bin/env bun

import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output, cwd, exit } from "node:process"

import {
  AGENT_GROUPS,
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

const usage = `Usage:
  bun scripts/opencode-routing-wizard.ts [--strong-model provider/model] [--fast-model provider/model] [--top-review-model provider/model] [--yes]

What it does:
  - shells out to \`opencode models\` to discover live available provider/model ids
  - writes the canonical Hyperpowers routing split:
    - global agent mappings in opencode.json
    - workflow overrides in .opencode/hyperpowers-routing.json
  - verifies generated routing by reading it back through the shared routing backend
`

const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = {
    yes: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case "--strong-model":
        parsed.strongModel = argv[index + 1]
        index += 1
        break
      case "--fast-model":
        parsed.fastModel = argv[index + 1]
        index += 1
        break
      case "--top-review-model":
        parsed.topReviewModel = argv[index + 1]
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

const renderPreview = (plan: ReturnType<typeof planRecommendedRouting>) => {
  console.log("\nPlanned Hyperpowers routing:")

  for (const [groupName, agents] of Object.entries(AGENT_GROUPS)) {
    console.log(`\n${groupName}:`)
    for (const agent of agents) {
      console.log(`  - ${agent}: ${plan.agent[agent].model}`)
    }
  }

  console.log("\nworkflow overrides:")
  for (const [workflowName, workflowAgents] of Object.entries(plan.workflowOverrides)) {
    for (const [agentName, entry] of Object.entries(workflowAgents)) {
      console.log(`  - ${workflowName}.${agentName}.model: ${entry.model}`)
    }
  }
}

const ensureModelInDiscovery = (model: string | undefined, models: string[], label: string) => {
  if (!model) return
  if (!models.includes(model)) {
    throw new Error(`${label} is not present in \`opencode models\` output: ${model}`)
  }
}

const promptForModel = async ({
  rl,
  models,
  label,
  allowBlank,
}: {
  rl: ReturnType<typeof createInterface>
  models: string[]
  label: string
  allowBlank?: boolean
}) => {
  console.log(`\nAvailable models from \`opencode models\`:`)
  models.forEach((model, index) => {
    console.log(`  ${index + 1}. ${model}`)
  })

  const suffix = allowBlank ? " (press Enter to reuse the strong model)" : ""
  const answer = (await rl.question(`Select ${label} by number or exact provider/model${suffix}: `)).trim()

  if (!answer && allowBlank) return undefined
  if (!answer) throw new Error(`${label} is required`)

  const numeric = Number(answer)
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= models.length) {
    return models[numeric - 1]
  }

  return answer
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

  const discovery = await discoverOpencodeModels(undefined, cwd())
  if (!discovery.ok) {
    console.error(`Model discovery failed: ${discovery.error.message}`)
    if (discovery.error.stderr) console.error(discovery.error.stderr)
    exit(1)
    return
  }

  let { strongModel, fastModel, topReviewModel } = args

  if (!strongModel || (!args.yes && (!fastModel || !topReviewModel))) {
    const rl = createInterface({ input, output })
    try {
      strongModel = strongModel ?? (await promptForModel({ rl, models: discovery.models, label: "strong model" }))
      fastModel = fastModel ?? (await promptForModel({ rl, models: discovery.models, label: "fast model", allowBlank: true }))
      topReviewModel =
        topReviewModel ??
        (await promptForModel({
          rl,
          models: discovery.models,
          label: "top-review model",
          allowBlank: true,
        }))
    } finally {
      rl.close()
    }
  }

  try {
    ensureModelInDiscovery(strongModel, discovery.models, "The selected strong model")
    ensureModelInDiscovery(fastModel, discovery.models, "The selected fast model")
    ensureModelInDiscovery(topReviewModel, discovery.models, "The selected top-review model")
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    exit(1)
    return
  }

  const plan = planRecommendedRouting({
    strongModel: strongModel!,
    fastModel,
    topReviewModel,
  })

  renderPreview(plan)

  if (!args.yes) {
    const rl = createInterface({ input, output })
    try {
      const answer = (await rl.question("\nWrite this routing config now? [y/N] ")).trim().toLowerCase()
      if (answer !== "y" && answer !== "yes") {
        console.log("No update was made.")
        return
      }
    } finally {
      rl.close()
    }
  }

  const writeResult = await writeRecommendedRoutingPlan(cwd(), plan)
  if (!writeResult.ok) {
    console.error(`Write failed: ${writeResult.error.message}`)
    exit(1)
    return
  }

  const verifyResult = await verifyRecommendedRoutingPlan(cwd(), plan, discovery.models)
  if (!verifyResult.ok) {
    console.error(`Verification failed: ${verifyResult.error.message}`)
    exit(1)
    return
  }

  console.log("\nVerification succeeded.")
  console.log(`- Wrote global agent mappings to opencode.json`)
  console.log(`- Wrote workflow overrides to .opencode/hyperpowers-routing.json`)
  console.log(`- Verified routing read-back through the shared routing backend`)
}

await main()
