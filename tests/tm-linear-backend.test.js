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

test("runLinearBackendCommand scopes linear list results to the requested parent identifier", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")
  const calls = []

  const result = await runLinearBackendCommand(["list", "--parent", "ENG-10"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      issueSearch: async () => ({
        nodes: [{ id: "lin-parent-10", identifier: "ENG-10", title: "Parent issue" }],
      }),
      issues: async args => {
        calls.push(args)

        if (args.filter?.parent?.id?.eq === "lin-parent-10") {
          return {
            nodes: [
              { identifier: "ENG-11", title: "Child issue", state: { name: "Todo", type: "unstarted" }, priority: 2 },
            ],
          }
        }

        return {
          nodes: [
            { identifier: "ENG-11", title: "Child issue", state: { name: "Todo", type: "unstarted" }, priority: 2 },
            { identifier: "ENG-21", title: "Other parent child", state: { name: "Todo", type: "unstarted" }, priority: 2 },
          ],
        }
      },
    }),
  })

  assert.equal(result.exitCode, 0)
  assert.deepEqual(calls, [{ first: 100, filter: { team: { id: { eq: "team-1" } }, parent: { id: { eq: "lin-parent-10" } } } }])
  assert.match(result.stdout, /ENG-11 Child issue/)
  assert.doesNotMatch(result.stdout, /ENG-21/)
})

test("runLinearBackendCommand resolves parent internal ids through direct issue lookup", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")
  const calls = []

  const result = await runLinearBackendCommand(["list", "--parent", "lin-parent-10"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      issue: async ref => {
        if (ref === "lin-parent-10") {
          return { id: "lin-parent-10", identifier: "ENG-10", title: "Parent issue" }
        }

        return null
      },
      issueSearch: async () => ({ nodes: [] }),
      issues: async args => {
        calls.push(args)

        if (args.filter?.parent?.id?.eq === "lin-parent-10") {
          return {
            nodes: [
              { identifier: "ENG-11", title: "Child issue", state: { name: "Todo", type: "unstarted" }, priority: 2 },
            ],
          }
        }

        return { nodes: [] }
      },
    }),
  })

  assert.equal(result.exitCode, 0)
  assert.deepEqual(calls, [{ first: 100, filter: { team: { id: { eq: "team-1" } }, parent: { id: { eq: "lin-parent-10" } } } }])
  assert.match(result.stdout, /ENG-11 Child issue/)
})

test("runLinearBackendCommand rejects cross-team parent lookups during direct issue resolution", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["list", "--parent", "lin-parent-10"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      issue: async () => ({ id: "lin-parent-10", identifier: "ENG-10", title: "Parent issue", teamId: "team-2" }),
      issueSearch: async () => {
        throw new Error("should not fall back to issueSearch for cross-team direct matches")
      },
      issues: async () => {
        throw new Error("should not list issues when parent belongs to another team")
      },
    }),
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /Linear issue "lin-parent-10" not found/)
})

test("runLinearBackendCommand preserves direct lookup errors for internal-id parents", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["list", "--parent", "lin-parent-10"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      issue: async () => {
        throw new Error("Linear API unavailable")
      },
      issueSearch: async () => {
        throw new Error("should not fall back to issueSearch when direct lookup fails")
      },
      issues: async () => {
        throw new Error("should not list issues when direct lookup fails")
      },
    }),
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /Linear API unavailable/)
})

test("runLinearBackendCommand returns a clear error when parent lookup fails during list", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["list", "--parent", "ENG-404"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      issueSearch: async () => ({ nodes: [] }),
      issues: async () => {
        throw new Error("should not list issues when parent lookup fails")
      },
    }),
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /Linear issue "ENG-404" not found/)
})

test("runLinearBackendCommand composes parent and status filters for linear list", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")
  const calls = []

  const result = await runLinearBackendCommand(["list", "--status", "open", "--parent", "lin-parent-10"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      issueSearch: async () => ({
        nodes: [{ id: "lin-parent-10", identifier: "ENG-10", title: "Parent issue" }],
      }),
      issues: async args => {
        calls.push(args)

        const nodes = [
          { identifier: "ENG-11", title: "Open child", state: { name: "Todo", type: "unstarted" }, priority: 2 },
          { identifier: "ENG-12", title: "Working child", state: { name: "In Progress", type: "started" }, priority: 2 },
          { identifier: "ENG-21", title: "Other parent child", state: { name: "Todo", type: "unstarted" }, priority: 2 },
        ]

        if (args.filter?.parent?.id?.eq === "lin-parent-10") {
          return { nodes: nodes.filter(node => node.identifier !== "ENG-21") }
        }

        return { nodes }
      },
    }),
  })

  assert.equal(result.exitCode, 0)
  assert.deepEqual(calls, [{ first: 100, filter: { team: { id: { eq: "team-1" } }, parent: { id: { eq: "lin-parent-10" } } } }])
  assert.match(result.stdout, /ENG-11 Open child/)
  assert.doesNotMatch(result.stdout, /ENG-12/)
  assert.doesNotMatch(result.stdout, /ENG-21/)
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

test("runLinearBackendCommand returns clear error when show target is ambiguous without an exact identifier match", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["show", "ENG-1"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      issueSearch: async () => ({
        nodes: [
          { id: "lin-a", identifier: "ENG-10", title: "Alpha" },
          { id: "lin-b", identifier: "ENG-11", title: "Beta" },
        ],
      }),
    }),
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /No exact Linear issue matched "ENG-1"/)
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

test("runLinearBackendCommand rejects unsupported tm status values", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["update", "ENG-7", "--status", "bogus"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
      issueSearch: async () => ({ nodes: [{ id: "lin-7", identifier: "ENG-7", title: "Do it", state: { name: "Todo", type: "unstarted" } }] }),
      updateIssue: async () => {
        throw new Error("should not update unsupported tm statuses")
      },
    }),
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /Unsupported tm status "bogus"/)
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

test("runLinearBackendCommand reports missing completed workflow state for close", async () => {
  const { runLinearBackendCommand } = requireFresh("../scripts/tm-linear-backend")

  const result = await runLinearBackendCommand(["close", "ENG-8"], {
    resolveContext: async () => ({
      team: { id: "team-1" },
      teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
      issueSearch: async () => ({ nodes: [{ id: "lin-8", identifier: "ENG-8", title: "Ship it", state: { name: "In Progress", type: "started" } }] }),
      updateIssue: async () => {
        throw new Error("should not update without completed state")
      },
    }),
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /No matching Linear completed state found/)
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
