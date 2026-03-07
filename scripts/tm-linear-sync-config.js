#!/usr/bin/env node
"use strict"

const { spawnSync } = require("node:child_process")

/**
 * Load a config value from: env var → bd config → null
 */
function loadConfigValue(envVar, bdConfigKey) {
  const envVal = process.env[envVar]
  if (envVal) return envVal

  const result = spawnSync("bd", ["config", "get", bdConfigKey], {
    encoding: "utf8",
    timeout: 5000,
  })
  const val = (result.stdout || "").trim()
  // bd config get returns "key (not set)" when unconfigured
  if (!val || val.endsWith("(not set)")) return null
  return val
}

/**
 * Load Linear configuration from environment and bd config.
 * Returns { apiKey, teamKey, projectName } or null if not configured.
 */
function loadLinearConfig() {
  const apiKey = loadConfigValue("LINEAR_API_KEY", "linear.api-key")
  if (!apiKey) return null

  const teamKey = loadConfigValue("LINEAR_TEAM_KEY", "linear.team-key")
  if (!teamKey) {
    console.error("tm-sync: LINEAR_API_KEY is set but LINEAR_TEAM_KEY is missing.")
    console.error("  Set it with: export LINEAR_TEAM_KEY=ENG")
    console.error("  Or: bd config set linear.team-key ENG")
    return null
  }

  const projectName = loadConfigValue("LINEAR_PROJECT_NAME", "linear.project-name") || null

  return { apiKey, teamKey, projectName }
}

module.exports = { loadLinearConfig, loadConfigValue }
