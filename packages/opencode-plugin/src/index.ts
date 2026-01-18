import type { Plugin } from "@opencode-ai/plugin"

const isEnvFile = (filePath: string) => {
  const parts = filePath.split("/")
  const base = parts[parts.length - 1] ?? filePath

  if (base === ".env.example") return false
  if (base === ".env") return true
  if (base.startsWith(".env.")) return true

  return filePath.includes("/.env")
}

const isGitHook = (filePath: string) => filePath.includes("/.git/hooks/")

const isPreCommitHook = (filePath: string) =>
  filePath.endsWith("/.git/hooks/pre-commit") || filePath.includes("/.git/hooks/pre-commit")

const shouldBlockBash = (command: string) => {
  const c = command.toLowerCase()

  if (c.includes(".git/hooks/pre-commit") || c.includes(".git\\hooks\\pre-commit")) {
    return "Modifying .git/hooks/pre-commit is blocked"
  }

  if (c.includes("git push") && (c.includes("--force") || c.includes("-f"))) {
    return "Force-push is blocked by default"
  }

  if (c.includes("rm -rf") || c.includes("rm -fr")) {
    return "Destructive deletes (rm -rf) are blocked by default"
  }

  return null
}

const deny = (reason: string) => {
  throw new Error(`Hyperpowers safety guardrail: ${reason}`)
}

const hyperpowersOpencodePlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      const tool = input.tool
      const args = output.args ?? {}

      if (tool === "read") {
        const filePath = String(args.filePath ?? "")
        if (filePath && isEnvFile(filePath)) deny("Reading .env files is not allowed")
      }

      if (tool === "edit" || tool === "write") {
        const filePath = String(args.filePath ?? "")
        if (!filePath) return
        if (isPreCommitHook(filePath)) deny("Direct edits to .git/hooks/pre-commit are not allowed")
        if (isGitHook(filePath)) deny("Direct edits to .git/hooks/* are not allowed")
      }

      if (tool === "bash") {
        const command = String(args.command ?? "")
        if (!command) return
        const blockReason = shouldBlockBash(command)
        if (blockReason) deny(blockReason)
      }
    },
  }
}

export default hyperpowersOpencodePlugin
