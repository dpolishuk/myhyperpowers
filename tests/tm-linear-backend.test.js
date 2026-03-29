const test = require("node:test")
const assert = require("node:assert/strict")

function requireFresh(modulePath) {
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
}

test("mapLinearStateToTmStatus maps blocked state names explicitly", () => {
  const { mapLinearStateToTmStatus } = requireFresh("../scripts/tm-linear-backend")

  assert.equal(mapLinearStateToTmStatus({ name: "Blocked on vendor", type: "unstarted" }), "blocked")
  assert.equal(mapLinearStateToTmStatus({ name: "Todo", type: "unstarted" }), "open")
  assert.equal(mapLinearStateToTmStatus({ name: "In Progress", type: "started" }), "in_progress")
  assert.equal(mapLinearStateToTmStatus({ name: "Done", type: "completed" }), "closed")
})

test("runLinearBackendCommand returns ready issues from unstarted and triage states", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["ready"], {
    resolveContext: async () => ({
      issues: async () => ({
        nodes: [
          { identifier: "ENG-1", title: "Ready issue", state: { name: "Todo", type: "unstarted" }, priority: 2 },
          { identifier: "ENG-2", title: "Working issue", state: { name: "In Progress", type: "started" }, priority: 2 },
        ],
      }),
    }),
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /ENG-1/)
  assert.doesNotMatch(result.stdout, /ENG-2/)
})

test("runLinearBackendCommand shows a Linear issue by identifier", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["show", "ENG-9"], {
    resolveContext: async () => ({
      issueSearch: async () => ({
        nodes: [
          {
            identifier: "ENG-9",
            title: "Backend contract",
            description: "Details",
            priority: 3,
            state: { name: "Todo", type: "unstarted" },
            labels: async () => ({ nodes: [{ name: "Task" }] }),
          },
        ],
      }),
    }),
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /ENG-9: Backend contract/)
  assert.match(result.stdout, /Status: open/)
})

test("runLinearBackendCommand updates issue status through matching workflow state", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")
  const updates = []

  const result = await runLinearBackendCommand(["update", "ENG-7", "--status", "in_progress"], {
    resolveContext: async () => ({
      teamStates: [
        { id: "todo-1", name: "Todo", type: "unstarted" },
        { id: "started-1", name: "In Progress", type: "started" },
      ],
      issueSearch: async () => ({
        nodes: [{ id: "lin-7", identifier: "ENG-7", title: "Do it", state: { name: "Todo", type: "unstarted" } }],
      }),
      updateIssue: async (id, params) => {
        updates.push({ id, params })
      },
    }),
  })

  assert.equal(result.exitCode, 0)
  assert.deepEqual(updates, [{ id: "lin-7", params: { stateId: "started-1" } }])
})
