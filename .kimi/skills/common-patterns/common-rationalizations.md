# Common Rationalizations - STOP

These rationalizations appear across multiple contexts. When you catch yourself thinking any of these, STOP - you're about to violate a skill.

## Process Shortcuts

| Excuse | Reality |
|--------|---------|
| "This is simple, can skip the process" | Simple tasks done wrong become complex problems. |
| "Just this once" | No exceptions. Process exists because exceptions fail. |
| "I'm confident this will work" | Confidence ≠ evidence. Run the verification. |
| "I'm tired" | Exhaustion ≠ excuse for shortcuts. |
| "No time for proper approach" | Shortcuts cost more time in rework. |
| "Partner won't notice" | They will. Trust is earned through consistency. |
| "Different words so rule doesn't apply" | Spirit over letter. Intent matters. |

## Verification Shortcuts

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification command. |
| "Looks correct" | Run it and see the output. |
| "Tests probably pass" | Probably ≠ verified. Run them. |
| "Linter passed, must be fine" | Linter ≠ compiler ≠ tests. Run everything. |
| "Partial check is enough" | Partial proves nothing about the whole. |
| "Agent said success" | Agents lie/hallucinate. Verify independently. |

## Documentation Shortcuts

| Excuse | Reality |
|--------|---------|
| "File probably exists" | Use tools to verify. Don't assume. |
| "Design mentioned it, must be there" | Codebase changes. Verify current state. |
| "I can verify quickly myself" | Use investigator agents. Prevents hallucination. |
| "User can figure it out during execution" | Your job is exact instructions. No ambiguity. |

## Planning Shortcuts

| Excuse | Reality |
|--------|---------|
| "Can skip exploring alternatives" | Comparison reveals issues. Always propose 2-3. |
| "Partner knows what they want" | Questions reveal hidden constraints. Always ask. |
| "Whole design at once for efficiency" | Incremental validation catches problems early. |
| "Checklist is just suggestion" | Create TodoWrite todos. Track properly. |
| "Subtask can reference parent for details" | NO. Subtasks must be complete. NO placeholders, NO "see parent". |
| "I'll use placeholder and fill in later" | NO. Write actual content NOW. No meta-references like "[detailed above]". |
| "Design field is too long, use placeholder" | Length doesn't matter. Write full content. Placeholder defeats the purpose. |
| "Should I continue to the next task?" | YES. You have a TodoWrite plan. Execute it. Don't interrupt your own workflow. |
| "Let me ask user's preference for remaining tasks" | NO. The user gave you the work. Do it. Only ask at natural completion points. |
| "Should I stop here or keep going?" | Your TodoWrite list tells you. If tasks remain, continue. |

## Execution Shortcuts

| Excuse | Reality |
|--------|---------|
| "Task is tracked in TodoWrite, don't need step tracking" | Tasks have 4-8 implementation steps. Without substep tracking, steps 4-8 get skipped. |
| "Made progress on the task, can move on" | Progress ≠ complete. All substeps must finish. 2/6 steps = 33%, not done. |
| "Other tasks are waiting, should continue" | Current task incomplete = blocked. Finish all substeps first. |
| "Can finish remaining steps later" | Later never comes. Complete all substeps now before closing task. |

## Quality Shortcuts

| Excuse | Reality |
|--------|---------|
| "Small gaps don't matter" | Spec is contract. All criteria must be met. |
| "Will fix in next PR" | This PR should complete this work. Fix now. |
| "Partner will review anyway" | You review first. Don't delegate your quality check. |
| "Good enough for now" | "Now" becomes "forever". Do it right. |

## TDD Shortcuts

| Excuse | Reality |
|--------|---------|
| "Test is obvious, can skip RED phase" | If you don't watch it fail, you don't know it works. |
| "Will adapt this code while writing test" | Delete it. Start fresh from the test. |
| "Can keep it as reference" | No. Delete means delete. |
| "Test is simple, don't need to run it" | Simple tests fail for subtle reasons. Run it. |

## Research Shortcuts

| Excuse | Reality |
|--------|---------|
| "I can research quickly myself" | Use agents. You'll hallucinate or waste context. |
| "Agent didn't find it first try, must not exist" | Be persistent. Refine query and try again. |
| "I know this codebase" | You don't know current state. Always verify. |
| "Obvious solution, skip research" | Codebase may have established pattern. Check first. |

**All of these mean: STOP. Follow the requirements exactly.**

## Why This Matters

Rationalizations are how good processes fail:
1. Developer thinks "just this once"
2. Shortcut causes subtle bug
3. Bug found in production/PR
4. More time spent fixing than process would have cost
5. Trust damaged

**No shortcuts. Follow the process. Every time.**
