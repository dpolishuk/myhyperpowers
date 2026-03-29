#!/usr/bin/env node
"use strict"

const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

function trimValue(value) {
  return (value || "").trim()
}

function stripInlineYamlComment(value) {
  const input = value || ""
  let inSingle = false
  let inDouble = false
  let output = ""

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]
    const prev = i > 0 ? input[i - 1] : ""

    if (ch === '"' && !inSingle && prev !== "\\") {
      inDouble = !inDouble
      output += ch
      continue
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      output += ch
      continue
    }

    if (ch === "#" && !inSingle && !inDouble && (i === 0 || /\s/.test(prev))) {
      break
    }

    output += ch
  }

  return trimValue(output)
}

function findRepoRoot(startDir = process.cwd()) {
  if (process.env.TM_REPO_ROOT && fs.existsSync(path.join(process.env.TM_REPO_ROOT, ".beads"))) {
    return process.env.TM_REPO_ROOT
  }

  let current = startDir
  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, ".beads"))) {
      return current
    }
    current = path.dirname(current)
  }

  return null
}

function readConfigValue(configPath, key) {
  if (!configPath || !fs.existsSync(configPath)) {
    return null
  }

  const content = fs.readFileSync(configPath, "utf8")
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Match key line — value may be empty (e.g. `api-key: ""`)
  const match = content.match(new RegExp(`^${escapedKey}:\\s*(.*)$`, "m"))
  if (!match) {
    return null
  }

  const rawValue = stripInlineYamlComment(match[1]).replace(/^['\"]|['\"]$/g, "")
  const normalizedValue = trimValue(rawValue)
  if (normalizedValue && normalizedValue.includes("(not set)")) {
    return null
  }

  // Return empty string (not null) when key exists but value is explicitly
  // empty — callers can distinguish "not configured" (null) from "cleared" ("").
  return normalizedValue || ""
}

function readBackendConfigValue(configKey) {
  const backend = trimValue(process.env.TM_BACKEND || "bd") || "bd"
  if (backend === "linear") return null

  const result = spawnSync(backend, ["config", "get", configKey], {
    encoding: "utf8",
    timeout: 5000,
  })

  if (result.error || result.status !== 0) {
    return null
  }

  const rawValue = trimValue(result.stdout || "")
  if (!rawValue || rawValue.includes("(not set)")) {
    return null
  }

  if (!isValidLinearFallbackValue(configKey, rawValue)) {
    return null
  }

  return rawValue
}

function isValidLinearFallbackValue(configKey, value) {
  if (!value || /\s/.test(value)) {
    return false
  }

  if (configKey === "linear.api-key") {
    return value.startsWith("lin_")
  }

  if (configKey === "linear.team-key") {
    return /^[A-Z0-9_-]+$/.test(value)
  }

  return true
}

/**
 * Load a config value from: env var → .beads/config.yaml → backend config → null
 */
function loadConfigValue(envVar, configKey) {
  // Explicit empty env var overrides project config (allows disabling with LINEAR_API_KEY="")
  if (Object.prototype.hasOwnProperty.call(process.env, envVar)) {
    const envVal = trimValue(process.env[envVar] || "")
    if (!envVal) return null
    return envVal
  }

  const repoRoot = findRepoRoot()
  const configPath = repoRoot ? path.join(repoRoot, ".beads", "config.yaml") : null
  return readConfigValue(configPath, configKey) ?? readBackendConfigValue(configKey)
}

/**
 * Load Linear configuration from environment, .beads/config.yaml, and backend config.
 * Returns { apiKey, teamKey } or null if not configured.
 */
function loadLinearConfig() {
  const apiKey = loadConfigValue("LINEAR_API_KEY", "linear.api-key")
  if (!apiKey) return null

  const teamKey = loadConfigValue("LINEAR_TEAM_KEY", "linear.team-key")
  if (!teamKey) {
    const err = new Error("LINEAR_API_KEY is set but LINEAR_TEAM_KEY is missing.\n  Set it with: export LINEAR_TEAM_KEY=ENG\n  Or: tm config set linear.team-key ENG")
    err.code = "MISCONFIGURED"
    throw err
  }

  return { apiKey, teamKey }
}

module.exports = { loadLinearConfig, loadConfigValue }
