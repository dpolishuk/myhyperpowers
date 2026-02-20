---
name: codex-skill-refactoring-design
description: "Use when the original skill 'refactoring-design' applies. Use when designing a refactor after diagnosis - selects patterns, defines composition and DI seams, and produces a test-ready refactor design spec"
---

<!-- Generated from skills/refactoring-design/SKILL.md -->

<skill_overview>
Design the refactor before touching code: choose the target structure, composition boundaries, DI seams, and a test strategy for happy/error paths.
</skill_overview>

<rigidity_level>
MEDIUM FREEDOM - Required outputs are strict; pattern selection and sequencing can vary by codebase.
</rigidity_level>

<quick_reference>
| Step | Action | Deliverable |
|------|--------|-------------|
| 1 | Review diagnosis report | Confirmed refactor targets |
| 2 | Define target design | Component diagram + responsibilities |
| 3 | Choose refactor patterns | Pattern mapping |
| 4 | Define DI seams | Interfaces + wiring plan |
| 5 | Encode invariants | Invalid states unrepresentable plan |
| 6 | Write test strategy | Happy/error tests + concurrency |
| 7 | Produce design spec | Required format |
</quick_reference>

<when_to_use>
- You have a diagnosis report and need a refactor design
- You want composition-first architecture and DI seams
- You need a test plan for happy paths and error states
</when_to_use>

<the_process>
## 1. Confirm Inputs
You must have a diagnosis report from `refactoring-diagnosis`.

## 2. Define the Target Design
Specify:
- Components/classes/modules and responsibilities
- Composition boundaries and ownership
- Data flow and error flow

## 3. Choose Refactor Patterns
Use the mapping in `references/patterns-and-choices.md` to select refactor patterns that address the diagnosed smells.

## 4. Define DI Seams
State:
- What dependencies become interfaces
- How they are injected (constructor, factory, parameter)
- What default implementations are used

## 5. Encode Invariants
Use `references/type-driven-design.md` to:
- Make invalid states unrepresentable
- Parse at boundaries, not throughout the core
- Define explicit error types for failure modes

## 6. Test Strategy
Design tests that use DI:
- Happy path tests for each component
- Error path tests for each dependency failure
- Concurrency/IPC tests where applicable

## 7. Produce Refactor Design Spec (Required Format)
Use this exact structure:

```
## Target Design
- Components:
- Responsibilities:
- Composition boundaries:
- Data flow:
- Error flow:

## Pattern Mapping
| Smell/Trap | Pattern/Refactor | Rationale |

## Dependency Injection Plan
- Interfaces:
- Injection points:
- Default implementations:

## Invariants and Types
- Invalid states to eliminate:
- Boundary parsing plan:
- Error type strategy:

## Test Strategy
- Happy path tests:
- Error path tests:
- Concurrency/IPC tests:

## Sequencing
1.
2.
3.

## Non-goals
- 
```
</the_process>

<common_rationalizations>
## Common Excuses
All of these mean: stop and complete the design spec first.
- "We'll figure it out as we code"
- "This is just cleanup"
- "Design is overkill"
- "I can't access the references or skill file" (proceed with required format and note assumptions)
</common_rationalizations>

<red_flags>
- No DI seams defined for dependencies
- No error-path tests planned
- Invariants left as comments instead of types
- Pattern choices not linked to smells
</red_flags>

<integration>
- Requires `refactoring-diagnosis`
- `refactoring-safely` executes the refactor only after this design exists
</integration>
