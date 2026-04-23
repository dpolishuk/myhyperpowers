const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const skillPath = path.join(process.cwd(), "skills", "subagent-driven-development", "SKILL.md")

test("subagent-driven-development skill has required content", () => {
  assert.equal(fs.existsSync(skillPath), true, `Skill file missing at ${skillPath}`)
  const content = fs.readFileSync(skillPath, "utf8")

  const requiredSections = [
    "<skill_overview>",
    "<quick_reference>",
    "<the_process>",
    "PRE_SHA",
    "POST_SHA",
    "git rev-parse HEAD",
    "tm show",
    "--json",
    "closed",
    "Senior Implementation Engineer",
    "RED-GREEN-REFACTOR",
    "sre-task-refinement",
    "test-runner",
    "Parallel Review"
  ]

  for (const section of requiredSections) {
    assert.ok(content.includes(section), `Missing required section/text: ${section}`)
  }
})
