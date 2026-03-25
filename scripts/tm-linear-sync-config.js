#!/usr/bin/env node
"use strict"

const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

function trimValue(value) {
  return (value || "").trim()
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
  const match = content.match(new RegExp(`^${escapedKey}:\\s*(.+)$`, "m"))
  if (!match) {
    return null
  }

  const rawValue = trimValue(match[1]).replace(/^['\"]|['\"]$/g, "")
  if (!rawValue || rawValue.includes("(not set)")) {
    return null
  }

  return rawValue
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

  return rawValue
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
