const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

test("test_subagent_protocol_enforces_sha_drift_for_implementation_tasks", () => {
  const skill = read("skills/subagent-driven-development/SKILL.md")
  // Should enforce SHA drift for feature|bug|task
  assert.ok(skill.match(/if\s*\[\[\s*["']?\$TASK_TYPE["']?\s*=~\s*\^\(feature\|bug\|task\)\$\s*\]\]/i), "Should enforce SHA drift for implementation tasks")
  // Should allow SHA unchanged for others if status is closed
  assert.ok(skill.match(/elif\s*\[\s*["']?\$STATUS["']?\s*!=\s*["']?closed["']?\s*\]/i), "Should allow SHA unchanged for analytical tasks if status is closed")
  // Positive assertion for the closed no-op path
  assert.ok(skill.match(/Analytical Tasks.*POST_SHA.*PRE_SHA.*status.*closed/i), "Should explicitly allow analytical no-op")
})

test("test_execute_ralph_mandates_sre_refinement_in_phase_1", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  const parts = skill.split(/## Phase 1:/i)
  assert.ok(parts.length > 1, "Should find Phase 1 header")
  const phase1 = parts[1].split(/## Phase 2:/i)[0]
  assert.ok(phase1.match(/sre-task-refinement/i), "Should mandate SRE task refinement in Phase 1")
})

test("test_execute_ralph_pruned_per_task_reviews", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  const phase2 = skill.split(/## Phase 2:/i)[1].split(/## Phase 3:/i)[0]
  assert.ok(phase2.match(/mcp_agents_agent_autonomous_reviewer/i), "Should use autonomous-reviewer in Phase 2")
  assert.ok(!phase2.match(/review-quality\(\)/i), "Should NOT use separate review-quality() in Phase 2")
})

test("test_execute_ralph_pruned_end_of_epic_reviews", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  const parts = skill.split(/## Phase 3: End-of-Epic Review/i)
  assert.ok(parts.length > 1, "Should find Phase 3 header")
  const phase3 = parts[1].split(/## Phase 4:/i)[0]
  assert.ok(phase3.match(/review-quality/i), "Phase 3 should have review-quality")
  assert.ok(phase3.match(/security-scanner/i), "Phase 3 should have security-scanner")
  assert.ok(phase3.match(/test-effectiveness-analyst/i), "Phase 3 should have test-effectiveness-analyst")
  assert.ok(!phase3.match(/review-simplification/i), "Phase 3 should NOT have review-simplification")
})

test("test_subagent_prompt_handoff_hardening_tags", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.ok(skill.match(/<epic_contract>/i), "Should mention <epic_contract> tag")
  assert.ok(skill.match(/<task_spec>/i), "Should mention <task_spec> tag")
})
