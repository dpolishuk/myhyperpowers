import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

import {
  AGENT_GROUPS,
  XPOWERS_AGENTS,
  PRESET_NAMES,
  executeRoutingAction,
  type RoutingToolArgs,
} from "./routing-wizard-core"

const agentRoutingConfigPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      xpowers_agent_routing_config: tool({
        description:
          "Read or update the shared XPowers agent-model routing map. Agent mappings live in opencode.json; workflow overrides live in .opencode/xpowers-routing.json.",
        args: {
          action: tool.schema
            .enum(["get", "set", "set-group", "apply-preset", "bootstrap"])
            .describe("Action: get (read), set (single agent), set-group (batch), apply-preset (profile), bootstrap (recommended setup)"),
          agent: tool.schema.string().optional().describe("Concrete XPowers agent name (for set)"),
          workflow: tool.schema.string().optional().describe("Optional workflow override name (for set)"),
          model: tool.schema.string().optional().describe("Provider/model value (for set, set-group)"),
          effort: tool.schema.string().optional().describe("Reasoning effort level: low, medium, high (for set)"),
          group: tool.schema.string().optional().describe("Agent group: orchestrator, workers, reviewers, all (for set-group)"),
          preset: tool.schema.string().optional().describe("Preset profile: cost-optimized, quality-first (for apply-preset)"),
          strongModel: tool.schema.string().optional().describe("Strong provider/model value for bootstrap"),
          fastModel: tool.schema.string().optional().describe("Optional fast provider/model value for bootstrap"),
          topReviewModel: tool.schema.string().optional().describe("Optional top-review provider/model value for bootstrap"),
        },
        async execute(args) {
          const result = await executeRoutingAction(ctx.directory, args as RoutingToolArgs)
          return JSON.stringify(result, null, 2)
        },
      }),
    },
  }
}

export { AGENT_GROUPS, XPOWERS_AGENTS, PRESET_NAMES, executeRoutingAction }
export default agentRoutingConfigPlugin
