#!/usr/bin/env bun

import * as p from "@clack/prompts"
import { existsSync } from "node:fs"
import { cp, mkdir, readFile, readdir, rm, writeFile, symlink, unlink, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dir, "..")
const VERSION = JSON.parse(await readFile(join(REPO_ROOT, ".claude-plugin", "plugin.json"), "utf8")).version as string

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SourceMapping = {
  from: string
  pattern?: string
  exclude?: string[]
}

type HostConfig = {
  id: string
  name: string
  detect: () => boolean
  targetDir: () => string
  sources: Record<string, SourceMapping>
  postInstall?: (targetDir: string) => Promise<void>
  postUninstall?: (targetDir: string) => Promise<void>
  availableFeatures: string[]
}

type FeatureConfig = {
  id: string
  name: string
  hint: string
  install: (hosts: string[], repoRoot: string) => Promise<string>
  uninstall: (manifest: InstallManifest) => Promise<void>
}

type InstallManifest = {
  version: string
  installedAt: string
  hosts: Record<string, { targetDir: string; files: string[] }>
  features: Record<string, { installed: boolean; metadata?: Record<string, unknown> }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const xdgConfig = () => process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
const manifestPath = () => join(homedir(), ".hyperpowers", "manifest.json")

const commandExists = (cmd: string): boolean => {
  try {
    const result = Bun.spawnSync(["bash", "-c", `command -v ${cmd}`], { stdout: "pipe", stderr: "pipe" })
    return result.exitCode === 0
  } catch {
    return false
  }
}

const copyDir = async (src: string, dest: string) => {
  await mkdir(dest, { recursive: true })
  await cp(src, dest, { recursive: true })
}

const copyFile = async (src: string, dest: string) => {
  await mkdir(dirname(dest), { recursive: true })
  await cp(src, dest)
}

const listItems = async (dir: string, pattern?: string, exclude?: string[]): Promise<string[]> => {
  if (!existsSync(dir)) return []
  const items = await readdir(dir)
  return items.filter((item) => {
    if (exclude?.includes(item)) return false
    if (pattern) {
      const regex = new RegExp("^(" + pattern.replace(/\*/g, ".*") + ")$")
      if (!regex.test(item)) return false
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// Host Configurations (data-driven, not 5x functions)
// ---------------------------------------------------------------------------

const HOSTS: HostConfig[] = [
  {
    id: "claude",
    name: "Claude Code",
    detect: () => existsSync(join(homedir(), ".claude")),
    targetDir: () => join(homedir(), ".claude"),
    sources: {
      skills: { from: "skills", exclude: ["common-patterns"] },
      agents: { from: "agents", exclude: ["CLAUDE.md"] },
      commands: { from: "commands" },
      hooks: { from: "hooks" },
    },
    availableFeatures: ["memsearch", "statusline"],
    postInstall: async (targetDir) => {
      // Copy statusline script
      const src = join(REPO_ROOT, "scripts", "hyperpowers-statusline.sh")
      if (existsSync(src)) {
        await copyFile(src, join(targetDir, "hyperpowers-statusline.sh"))
      }
    },
  },
  {
    id: "opencode",
    name: "OpenCode",
    detect: () => existsSync(join(xdgConfig(), "opencode")),
    targetDir: () => join(xdgConfig(), "opencode"),
    sources: {
      skills: { from: ".opencode/skills", pattern: "hyperpowers-*|beads-*" },
      agents: { from: ".opencode/agents" },
      commands: { from: ".opencode/commands" },
      plugins: { from: ".opencode/plugins" },
      scripts: { from: ".opencode/scripts" },
    },
    availableFeatures: ["memsearch", "supermemory", "routing-wizard"],
    postInstall: async (targetDir) => {
      // Copy package.json and run bun install
      const pkgSrc = join(REPO_ROOT, ".opencode", "package.json")
      if (existsSync(pkgSrc)) {
        await copyFile(pkgSrc, join(targetDir, "package.json"))
        if (commandExists("bun")) {
          Bun.spawnSync(["bun", "install", "--silent"], { cwd: targetDir, stdout: "pipe", stderr: "pipe" })
        }
      }
      // Copy config files
      for (const f of ["task-context.json", "cass-memory.json"]) {
        const src = join(REPO_ROOT, ".opencode", f)
        if (existsSync(src)) await copyFile(src, join(targetDir, f))
      }
    },
  },
  {
    id: "kimi",
    name: "Kimi CLI",
    detect: () => existsSync(join(xdgConfig(), "agents")) || existsSync(join(homedir(), ".kimi")),
    targetDir: () => existsSync(join(homedir(), ".kimi")) ? join(homedir(), ".kimi") : join(xdgConfig(), "agents"),
    sources: {
      skills: { from: ".kimi/skills" },
    },
    availableFeatures: [],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    detect: () => commandExists("gemini"),
    targetDir: () => join(REPO_ROOT, ".gemini-extension"),
    sources: {},
    availableFeatures: [],
    postInstall: async () => {
      if (commandExists("gemini")) {
        Bun.spawnSync(["gemini", "extensions", "install", REPO_ROOT], { stdout: "pipe", stderr: "pipe" })
      }
    },
    postUninstall: async () => {
      if (commandExists("gemini")) {
        Bun.spawnSync(["gemini", "extensions", "uninstall", REPO_ROOT], { stdout: "pipe", stderr: "pipe" })
      }
    },
  },
]

// ---------------------------------------------------------------------------
// Feature Configurations
// ---------------------------------------------------------------------------

const FEATURES: FeatureConfig[] = [
  {
    id: "memsearch",
    name: "memsearch long memory",
    hint: "local ONNX embeddings, markdown storage, cross-session recall",
    install: async () => {
      if (commandExists("python3")) {
        const result = Bun.spawnSync(["python3", "-m", "pip", "install", "--user", "memsearch[onnx]", "--quiet"], {
          stdout: "pipe",
          stderr: "pipe",
        })
        if (result.exitCode === 0) {
          // Try to init config
          Bun.spawnSync(["memsearch", "config", "init", "--non-interactive"], { stdout: "pipe", stderr: "pipe" })
          return "memsearch[onnx] installed"
        }
        return "memsearch install failed"
      }
      return "python3 not found — install manually: python3 -m pip install --user memsearch[onnx]"
    },
    uninstall: async () => {
      if (commandExists("python3")) {
        Bun.spawnSync(["python3", "-m", "pip", "uninstall", "-y", "memsearch"], { stdout: "pipe", stderr: "pipe" })
      }
    },
  },
  {
    id: "supermemory",
    name: "supermemory (cloud)",
    hint: "cloud-hosted memory by supermemory.ai — requires API key (free tier available)",
    install: async (hosts) => {
      if (!hosts.includes("opencode")) return "skipped (OpenCode not selected)"
      if (!commandExists("bun")) return "skipped (bun not found)"

      // Install the npm plugin
      const result = Bun.spawnSync(["bunx", "opencode-supermemory@latest", "install", "--no-tui"], {
        stdout: "pipe",
        stderr: "pipe",
      })
      if (result.exitCode === 0) {
        return "supermemory plugin installed — run /supermemory-login in OpenCode to authenticate"
      }
      return "supermemory install failed — try: bunx opencode-supermemory@latest install"
    },
    uninstall: async () => {
      // Remove plugin from opencode.jsonc
      const configPaths = [
        join(xdgConfig(), "opencode", "opencode.jsonc"),
        join(xdgConfig(), "opencode", "opencode.json"),
      ]
      for (const configPath of configPaths) {
        if (!existsSync(configPath)) continue
        try {
          const raw = await readFile(configPath, "utf8")
          const cleaned = raw.replace(/"opencode-supermemory@[^"]*",?\s*/g, "")
          await writeFile(configPath, cleaned, "utf8")
        } catch { /* skip */ }
      }
      // Remove credentials
      await rm(join(homedir(), ".supermemory-opencode"), { recursive: true, force: true }).catch(() => {})
      // Remove commands
      const cmdDir = join(xdgConfig(), "opencode", "command")
      for (const cmd of ["supermemory-init.md", "supermemory-login.md", "supermemory-logout.md"]) {
        await unlink(join(cmdDir, cmd)).catch(() => {})
      }
    },
  },
  {
    id: "statusline",
    name: "Status line",
    hint: "shows active agent + model in Claude Code bottom bar",
    install: async (hosts) => {
      if (!hosts.includes("claude")) return "skipped (Claude Code not selected)"
      const home = join(homedir(), ".claude")
      const scriptPath = join(home, "hyperpowers-statusline.sh")
      const settingsPath = join(home, "settings.json")

      try {
        let settings: Record<string, unknown> = {}
        if (existsSync(settingsPath)) {
          settings = JSON.parse(await readFile(settingsPath, "utf8"))
        }
        if (!settings.statusline) {
          settings.statusline = scriptPath
          await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8")
        }
      } catch { /* skip if settings.json is invalid */ }
      return "status line configured"
    },
    uninstall: async () => {
      const settingsPath = join(homedir(), ".claude", "settings.json")
      if (existsSync(settingsPath)) {
        try {
          const settings = JSON.parse(await readFile(settingsPath, "utf8"))
          if (settings.statusline?.includes("hyperpowers")) {
            delete settings.statusline
            await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8")
          }
        } catch { /* skip */ }
      }
    },
  },
  {
    id: "routing-wizard",
    name: "Agent routing wizard",
    hint: "configure models + effort per agent (OpenCode)",
    install: async (hosts, repoRoot) => {
      if (!hosts.includes("opencode")) return "skipped (OpenCode not selected)"
      if (!commandExists("bun")) return "skipped (bun not found)"
      const wizardPath = join(repoRoot, "scripts", "opencode-routing-wizard.ts")
      if (existsSync(wizardPath)) {
        const result = Bun.spawnSync(["bun", wizardPath], { stdout: "inherit", stderr: "inherit", stdin: "inherit" })
        return result.exitCode === 0 ? "routing wizard completed" : "routing wizard failed"
      }
      return "wizard script not found"
    },
    uninstall: async () => { /* no-op, routing config is user data */ },
  },
  {
    id: "tm-cli",
    name: "tm CLI",
    hint: "task manager wrapper for beads",
    install: async () => {
      const binDir = join(homedir(), ".local", "bin")
      const libDir = join(homedir(), ".local", "lib", "tm")
      await mkdir(binDir, { recursive: true })
      await mkdir(libDir, { recursive: true })

      const tmSrc = join(REPO_ROOT, "scripts", "tm")
      if (existsSync(tmSrc)) {
        await copyFile(tmSrc, join(binDir, "tm"))
        Bun.spawnSync(["chmod", "+x", join(binDir, "tm")])

        // Copy companion files
        for (const name of ["tm-linear-sync.js", "tm-linear-sync-config.js"]) {
          const src = join(REPO_ROOT, "scripts", name)
          if (existsSync(src)) {
            await copyFile(src, join(libDir, name))
            await symlink(join(libDir, name), join(binDir, name)).catch(() => {})
          }
        }
        return "tm CLI installed to ~/.local/bin/"
      }
      return "tm script not found"
    },
    uninstall: async () => {
      const binDir = join(homedir(), ".local", "bin")
      const libDir = join(homedir(), ".local", "lib", "tm")
      for (const f of ["tm", "tm-linear-sync.js", "tm-linear-sync-config.js"]) {
        await unlink(join(binDir, f)).catch(() => {})
      }
      await rm(libDir, { recursive: true, force: true }).catch(() => {})
    },
  },
]

// ---------------------------------------------------------------------------
// Core Install Engine
// ---------------------------------------------------------------------------

const installHost = async (host: HostConfig): Promise<string[]> => {
  const target = host.targetDir()
  const installedFiles: string[] = []

  for (const [category, source] of Object.entries(host.sources)) {
    const srcDir = join(REPO_ROOT, source.from)
    if (!existsSync(srcDir)) continue

    const items = await listItems(srcDir, source.pattern, source.exclude)
    const destDir = join(target, category)
    await mkdir(destDir, { recursive: true })

    for (const item of items) {
      const srcPath = join(srcDir, item)
      const destPath = join(destDir, item)
      const s = await stat(srcPath)
      if (s.isDirectory()) {
        await copyDir(srcPath, destPath)
        installedFiles.push(`${category}/${item}/`)
      } else {
        await copyFile(srcPath, destPath)
        installedFiles.push(`${category}/${item}`)
      }
    }
  }

  // Write version file
  await writeFile(join(target, ".hyperpowers-version"), VERSION + "\n", "utf8")
  installedFiles.push(".hyperpowers-version")

  // Run post-install
  if (host.postInstall) await host.postInstall(target)

  return installedFiles
}

const uninstallHost = async (hostId: string, manifest: InstallManifest) => {
  const hostData = manifest.hosts[hostId]
  if (!hostData) return

  for (const file of hostData.files) {
    const fullPath = join(hostData.targetDir, file)
    if (file.endsWith("/")) {
      await rm(fullPath, { recursive: true, force: true }).catch(() => {})
    } else {
      await unlink(fullPath).catch(() => {})
    }
  }
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

const readManifest = async (): Promise<InstallManifest | null> => {
  const path = manifestPath()
  if (!existsSync(path)) return null
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch {
    return null
  }
}

const writeManifest = async (manifest: InstallManifest) => {
  const path = manifestPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(manifest, null, 2) + "\n", "utf8")
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

type CliArgs = {
  yes: boolean
  uninstall: boolean
  hosts: string[]
  features: string[]
  help: boolean
}

const parseArgs = (): CliArgs => {
  const args: CliArgs = { yes: false, uninstall: false, hosts: [], features: [], help: false }
  const argv = process.argv.slice(2)

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--yes":
      case "-y":
        args.yes = true
        break
      case "--uninstall":
      case "--remove":
        args.uninstall = true
        break
      case "--hosts":
        args.hosts = (argv[++i] || "").split(",").filter(Boolean)
        break
      case "--features":
        args.features = (argv[++i] || "").split(",").filter(Boolean)
        break
      case "--help":
      case "-h":
        args.help = true
        break
    }
  }
  return args
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
  const args = parseArgs()

  if (args.help) {
    console.log(`Hyperpowers Installer v${VERSION}

Usage:
  bun scripts/install.ts              # Interactive TUI installer
  bun scripts/install.ts --yes        # Install all detected hosts + all features
  bun scripts/install.ts --uninstall  # Remove everything
  bun scripts/install.ts --hosts claude,opencode --features memsearch,tm-cli

Options:
  --yes, -y          Auto-install all detected hosts and features
  --uninstall        Remove all installed files and features
  --hosts <list>     Comma-separated host IDs: claude,opencode,kimi,gemini
  --features <list>  Comma-separated feature IDs: memsearch,supermemory,statusline,routing-wizard,tm-cli
  --help, -h         Show this help
`)
    return
  }

  // --- Uninstall ---
  if (args.uninstall) {
    p.intro("Hyperpowers Uninstaller")

    const manifest = await readManifest()
    if (!manifest) {
      p.log.error("No installation manifest found. Nothing to uninstall.")
      p.outro("Done.")
      return
    }

    p.log.info(`Found installation v${manifest.version} from ${manifest.installedAt}`)

    const s = p.spinner()

    // Uninstall features
    for (const feature of FEATURES) {
      if (manifest.features[feature.id]?.installed) {
        s.start(`Removing ${feature.name}...`)
        await feature.uninstall(manifest)
        s.stop(`${feature.name} removed`)
      }
    }

    // Uninstall hosts
    for (const hostId of Object.keys(manifest.hosts)) {
      s.start(`Removing from ${hostId}...`)
      await uninstallHost(hostId, manifest)
      const host = HOSTS.find((h) => h.id === hostId)
      if (host?.postUninstall) await host.postUninstall(manifest.hosts[hostId].targetDir)
      s.stop(`${hostId} removed`)
    }

    // Remove manifest
    await unlink(manifestPath()).catch(() => {})

    p.outro("Hyperpowers uninstalled completely.")
    return
  }

  // --- Install ---
  p.intro(`Hyperpowers Installer v${VERSION}`)

  // Phase 1: Detect hosts
  const detected = HOSTS.filter((h) => h.detect())
  const notDetected = HOSTS.filter((h) => !h.detect())

  for (const h of detected) p.log.success(`${h.name} detected`)
  for (const h of notDetected) p.log.warn(`${h.name} not found`)

  if (detected.length === 0) {
    p.log.error("No supported hosts detected. Install Claude Code, OpenCode, or another supported tool first.")
    p.outro("Nothing to install.")
    return
  }

  // Phase 2: Select hosts
  let selectedHostIds: string[]

  if (args.yes || args.hosts.length > 0) {
    selectedHostIds = args.hosts.length > 0 ? args.hosts : detected.map((h) => h.id)
  } else {
    const result = await p.multiselect({
      message: "Install to which hosts?",
      options: detected.map((h) => ({ value: h.id, label: h.name, hint: h.targetDir() })),
      initialValues: detected.map((h) => h.id),
      required: true,
    })
    if (p.isCancel(result)) { p.cancel("Cancelled."); return }
    selectedHostIds = result as string[]
  }

  // Phase 3: Select features
  const availableFeatures = FEATURES.filter((f) =>
    f.id === "tm-cli" || selectedHostIds.some((hid) => HOSTS.find((h) => h.id === hid)?.availableFeatures.includes(f.id)),
  )

  let selectedFeatureIds: string[]

  if (args.yes || args.features.length > 0) {
    selectedFeatureIds = args.features.length > 0 ? args.features : availableFeatures.map((f) => f.id)
  } else {
    if (availableFeatures.length > 0) {
      const result = await p.multiselect({
        message: "Select optional features:",
        options: availableFeatures.map((f) => ({ value: f.id, label: f.name, hint: f.hint })),
        initialValues: availableFeatures.map((f) => f.id),
        required: false,
      })
      if (p.isCancel(result)) { p.cancel("Cancelled."); return }
      selectedFeatureIds = result as string[]
    } else {
      selectedFeatureIds = []
    }
  }

  // Phase 4: Install hosts
  const s = p.spinner()
  const existingManifest = await readManifest()
  const manifest: InstallManifest = {
    version: VERSION,
    installedAt: new Date().toISOString(),
    hosts: { ...(existingManifest?.hosts ?? {}) },
    features: { ...(existingManifest?.features ?? {}) },
  }

  for (const hostId of selectedHostIds) {
    const host = HOSTS.find((h) => h.id === hostId)
    if (!host) {
      p.log.warn(`Unknown host "${hostId}" — skipping. Supported: ${HOSTS.map((h) => h.id).join(", ")}`)
      continue
    }

    s.start(`Installing to ${host.name}...`)
    const files = await installHost(host)
    manifest.hosts[hostId] = { targetDir: host.targetDir(), files }
    s.stop(`${host.name}: ${files.length} items installed`)
  }

  // Phase 5: Install features
  for (const featureId of selectedFeatureIds) {
    const feature = FEATURES.find((f) => f.id === featureId)
    if (!feature) continue

    s.start(`Setting up ${feature.name}...`)
    const result = await feature.install(selectedHostIds, REPO_ROOT)
    const success = !result.includes("failed") && !result.includes("not found") && !result.includes("skipped")
    manifest.features[featureId] = { installed: success, metadata: { lastResult: result } }
    s.stop(result)
  }

  // Phase 6: Write manifest
  await writeManifest(manifest)
  p.log.info(`Manifest written to ${manifestPath()}`)

  p.outro(`Done! v${VERSION} installed to ${selectedHostIds.length} host(s) with ${selectedFeatureIds.length} feature(s).`)
}

await main()
