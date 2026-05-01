import { join, dirname } from "node:path"
import { existsSync } from "node:fs"

export function getTmBin(cwd: string): string {
  let current = cwd
  while (current) {
    const localTm = join(current, "scripts", "tm")
    if (existsSync(localTm)) return localTm
    if (existsSync(join(current, ".git"))) break
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return "tm"
}
