---
name: refactoring-diagnosis
description: Use when identifying bad code/design and selecting refactor targets - produces a diagnosis report with smells, risks, and refactor vs rewrite decision
---

<skill_overview>
Diagnose before refactoring: identify smells and traps with evidence, assess risk, and decide refactor vs rewrite before any code changes.
</skill_overview>

<rigidity_level>
MEDIUM FREEDOM - The required outputs and evidence standards are strict; the analysis depth and tools used can vary by codebase.
</rigidity_level>

<quick_reference>
| Step | Action | Deliverable |
|------|--------|-------------|
| 1 | Define scope and constraints | Scope statement |
| 2 | Gather evidence (code, tests, runtime behavior) | Evidence notes |
| 3 | Map evidence to smells/traps | Smell table |
| 4 | Assess risk and impact | Risk matrix |
| 5 | Decide refactor vs rewrite | Decision + rationale |
| 6 | Produce diagnosis report | Required report format |
</quick_reference>

<when_to_use>
- You want to identify bad code/design and decide what to refactor
- You keep seeing recurring issues (deadlocks, regressions, fragile tests)
- You need a defensible, prioritized refactor target list
- You must decide between refactor vs rewrite
</when_to_use>

<the_process>
## 1. Define Scope (No Vague Targets)
State the specific module/component/system boundary you are diagnosing and what is out of scope.

## 2. Gather Evidence
Minimum evidence sources:
- Read relevant production code paths
- Read tests or lack thereof
- Identify entrypoints and call chains
- Note any concurrency/IPC boundaries

## 3. Map to Smells/Traps (Evidence Required)
Use the catalogs in references:
- `references/smell-catalog.md`
- `references/test-smells.md`
- `references/concurrency-ipc-traps.md`

For each smell/trap, cite concrete evidence (file path, function, behavior).

## 4. Assess Risk and Impact
Classify each smell by:
- Severity (low/med/high)
- Change risk (low/med/high)
- Blast radius (local/module/system)
- Recurrence likelihood

## 5. Refactor vs Rewrite Decision
Rules of thumb:
- If tests are absent and behavior is unknown → write characterization tests before refactor
- If 3+ refactor attempts failed or behavior is unstable → consider rewrite
- If change risk is high and scope is large → split into smaller refactors

## 6. Produce Diagnosis Report (Required Format)
Use this exact structure:

```
## Scope
- In scope:
- Out of scope:
- Constraints:

## Evidence
- Files reviewed:
- Entry points:
- Tests reviewed:
- Concurrency/IPC boundaries:

## Smells and Traps (Evidence-Backed)
| Smell/Trap | Evidence | Risk | Suggested Refactor Direction |

## Test Smells
| Test Smell | Evidence | Risk | Suggested Fix |

## Concurrency/IPC Traps
| Trap | Evidence | Risk | Suggested Fix |

## Risk Assessment
- Highest risk areas:
- Largest blast radius:
- Most likely regression vectors:

## Refactor vs Rewrite Decision
- Decision:
- Rationale:

## Top Refactor Targets (Prioritized)
1.
2.
3.

## Non-goals
- 

## Open Questions
- 
```
</the_process>

<common_rationalizations>
## Common Excuses
All of these mean: stop and complete diagnosis first.
- "We already know what's wrong"
- "Time pressure, just fix it"
- "We can refactor as we go"
- "It's just cleanup"
- "I can't access the references or skill file" (proceed with required format and note assumptions)
</common_rationalizations>

<red_flags>
- Starting implementation without a diagnosis report
- No evidence cited for smells/traps
- Mixing bug fixes with refactoring goals
- Skipping concurrency/IPC analysis in concurrent systems
</red_flags>

<integration>
- Use `refactoring-design` after diagnosis to produce the refactor design
- Use `refactoring-safely` to execute only after diagnosis + design are complete
</integration>
