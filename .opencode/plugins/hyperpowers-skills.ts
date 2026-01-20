import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import matter from "gray-matter"
import { z } from "zod"
import { dirname, relative, sep } from "node:path"

const ToolNameSchema = z
  .string()
  .regex(/^[a-z0-9_]+$/, "Tool names must be lowercase with underscores")

const normalizeAllowedTools = (tools: string[] | undefined) => {
  if (!tools) return undefined
  const normalized = tools
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.toLowerCase())

  // Minimal enforcement: ensure names are plausible and non-empty.
  // (Actual permission enforcement is handled by OpenCode permissions.)
  const unique = Array.from(new Set(normalized))
  return unique.length ? unique : undefined
}

const SkillFrontmatterSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Name must be lowercase alphanumeric with hyphens")
    .min(1),
  description: z.string().min(20, "Description must be at least 20 characters for discoverability"),
  license: z.string().optional(),
  "allowed-tools": z.array(z.string()).optional(),
  metadata: z.record(z.string()).optional(),
})

type Skill = {
  name: string
  description: string
  allowedTools?: string[]
  fullPath: string
  content: string
  toolName: string
}

const generateToolName = (skillPath: string, baseDir: string) => {
  const rel = relative(baseDir, skillPath)
  const dirPath = dirname(rel)
  const components = dirPath.split(sep).filter((c) => c !== ".")
  return "skills_" + components.join("_").replace(/-/g, "_")
}

const discoverSkillFiles = async (dir: string) => {
  const files: string[] = []

  // Discover skills recursively.
  for await (const path of new Bun.Glob("**/SKILL.md").scan({ cwd: dir })) {
    files.push(`${dir}/${path}`)
  }

  return files
}

const parseSkill = async (skillPath: string, baseDir: string): Promise<Skill | null> => {
  try {
    const raw = await Bun.file(skillPath).text()
    const { data, content } = matter(raw)

    const fm = SkillFrontmatterSchema.safeParse(data)
    if (!fm.success) return null

    // Validate name matches directory name
    const dirName = skillPath.split("/").slice(-2, -1)[0]
    if (!dirName || fm.data.name !== dirName) return null

    const toolName = generateToolName(skillPath, baseDir)
    const tn = ToolNameSchema.safeParse(toolName)
    if (!tn.success) return null

    return {
      name: fm.data.name,
      description: fm.data.description,
      allowedTools: normalizeAllowedTools(fm.data["allowed-tools"]),
      fullPath: dirname(skillPath),
      content: content.trim(),
      toolName,
    }
  } catch {
    return null
  }
}

const hyperpowersSkillsPlugin: Plugin = async (ctx) => {
  const projectSkills = `${ctx.directory}/.opencode/skills`
  const userSkills = `${process.env.HOME}/.opencode/skills`
  const xdgSkills = `${process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`}/opencode/skills`

  const bases = [xdgSkills, userSkills, projectSkills]

  const tools: Record<string, any> = {}

  for (const baseDir of bases) {
    const exists = await Bun.file(baseDir).exists()
    if (!exists) continue

    const skillFiles = await discoverSkillFiles(baseDir)

    for (const skillPath of skillFiles) {
      const skill = await parseSkill(skillPath, baseDir)
      if (!skill) continue

      tools[skill.toolName] = tool({
        description: skill.description,
        args: {},
        async execute(_args: any, toolCtx: any) {
          const sessionID = toolCtx.sessionID

          const sendSilentPrompt = (text: string) =>

            ctx.client.session.prompt({
              path: { id: sessionID },
              body: {
                noReply: true,
                parts: [{ type: "text", text }],
              },
            })

          await sendSilentPrompt(`The "${skill.name}" skill is loading\n${skill.name}`)

          if (skill.allowedTools && skill.allowedTools.length > 0) {
            await sendSilentPrompt(
              `Allowed tools for this skill: ${skill.allowedTools.join(", ")}`
            )
          }

          await sendSilentPrompt(`Base directory for this skill: ${skill.fullPath}\n\n${skill.content}`)

          return `Launching skill: ${skill.name}`
        },
      })
    }
  }

  return { tool: tools }
}

export default hyperpowersSkillsPlugin
