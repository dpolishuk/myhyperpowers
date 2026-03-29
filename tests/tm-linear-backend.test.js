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
  assert.equal(mapLinearStateToTmStatus({ name: "Canceled", type: "canceled" }), "closed")
})

test("runLinearBackendCommand returns ready issues from unstarted and triage states", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")
  const calls = []

  const result = await runLinearBackendCommand(["ready"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      issues: async args => {
        calls.push(args)
        return ({
        nodes: [
          { identifier: "ENG-1", title: "Ready issue", state: { name: "Todo", type: "unstarted" }, priority: 2 },
          { identifier: "ENG-3", title: "Triage issue", state: { name: "Triage", type: "unstarted" }, priority: 2 },
          { identifier: "ENG-2", title: "Working issue", state: { name: "In Progress", type: "started" }, priority: 2 },
          { identifier: "ENG-4", title: "Canceled issue", state: { name: "Canceled", type: "canceled" }, priority: 2 },
        ],
      })},
    }),
  })

  assert.equal(result.exitCode, 0)
  assert.deepEqual(calls, [{ first: 100, filter: { team: { id: { eq: "team-1" } } } }])
  assert.match(result.stdout, /ENG-1/)
  assert.match(result.stdout, /ENG-3/)
  assert.doesNotMatch(result.stdout, /ENG-2/)
  assert.doesNotMatch(result.stdout, /ENG-4/)
})

test("runLinearBackendCommand shows a Linear issue by identifier", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["show", "ENG-9"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      issueSearch: async () => ({
        nodes: [
          {
            identifier: "ENG-90",
            title: "Wrong issue",
            description: "Wrong",
            priority: 3,
            state: { name: "Todo", type: "unstarted" },
            labels: async () => ({ nodes: [{ name: "Task" }] }),
          },
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

test("runLinearBackendCommand returns clear error when show target is missing", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["show", "ENG-404"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      issueSearch: async () => ({ nodes: [] }),
    }),
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /Linear issue "ENG-404" not found/)
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

test("runLinearBackendCommand reports missing workflow state for update", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["update", "ENG-7", "--status", "blocked"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
      issueSearch: async () => ({ nodes: [{ id: "lin-7", identifier: "ENG-7", title: "Do it", state: { name: "Todo", type: "unstarted" } }] }),
      updateIssue: async () => {
        throw new Error("should not update without a matching workflow state")
      },
    }),
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /No matching Linear workflow state found for tm status "blocked"/)
})

test("runLinearBackendCommand closes issues through a completed workflow state", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")
  const updates = []

  const result = await runLinearBackendCommand(["close", "ENG-8"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      teamStates: [{ id: "done-1", name: "Done", type: "completed" }],
      issueSearch: async () => ({ nodes: [{ id: "lin-8", identifier: "ENG-8", title: "Ship it", state: { name: "In Progress", type: "started" } }] }),
      updateIssue: async (id, params) => updates.push({ id, params }),
    }),
  })

  assert.equal(result.exitCode, 0)
  assert.deepEqual(updates, [{ id: "lin-8", params: { stateId: "done-1" } }])
})

test("runLinearBackendCommand returns a capability-gated error for unsupported commands", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["create", "Title"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
    }),
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /linear backend command "create" is not yet implemented/)
})
