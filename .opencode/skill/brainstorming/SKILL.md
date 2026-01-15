---
name: brainstorming
description: Use when creating or developing anything, before writing code - refines rough ideas into bd epics with immutable requirements
---

<skill_overview>
Turn rough ideas into validated designs stored as bd epics with immutable requirements; tasks created iteratively as you learn, not upfront.
</skill_overview>

<rigidity_level>
HIGH FREEDOM - Adapt Socratic questioning to context, but always create immutable epic before code and only create first task (not full tree).
</rigidity_level>

<quick_reference>
| Step | Action | Deliverable |
|------|--------|-------------|
| 1 | Ask questions (one at a time) | Understanding of requirements |
| 2 | Research (agents for codebase/internet) | Existing patterns and approaches |
| 3 | Propose 2-3 approaches with trade-offs | Recommended option |
| 4 | Present design in sections (200-300 words) | Validated architecture |
| 5 | Create bd epic with IMMUTABLE requirements | Epic with anti-patterns |
| 6 | Create ONLY first task | Ready for executing-plans |
| 7 | Hand off to executing-plans | Iterative implementation begins |

**Key:** Epic = contract (immutable), Tasks = adaptive (created as you learn)
</quick_reference>

<when_to_use>
- User describes new feature to implement
- User has rough idea that needs refinement
- About to write code without clear requirements
- Need to explore approaches before committing
- Requirements exist but architecture unclear

**Don't use for:**
- Executing existing plans (use hyperpowers:executing-plans)
- Fixing bugs (use hyperpowers:fixing-bugs)
- Refactoring (use hyperpowers:refactoring-safely)
- Requirements already crystal clear and epic exists
</when_to_use>

<the_process>
## 1. Understanding the Idea

**Announce:** "I'm using the brainstorming skill to refine your idea into a design."

**Check current state:**
- Recent commits, existing docs, codebase structure
- Dispatch `hyperpowers:codebase-investigator` for existing patterns
- Dispatch `hyperpowers:internet-researcher` for external APIs/libraries

**REQUIRED: Use AskUserQuestion tool for all questions**
- One question at a time (don't batch multiple questions)
- Prefer multiple choice options (easier to answer)
- Wait for response before asking next question
- Focus on: purpose, constraints, success criteria
- Gather enough context to propose approaches

**Do NOT just print questions and wait for "yes"** - use the AskUserQuestion tool.

**Example questions:**
- "What problem does this solve for users?"
- "Are there existing implementations we should follow?"
- "What's the most important success criterion?"
- "Token storage: cookies, localStorage, or sessionStorage?"

---

## 2. Exploring Approaches

**Research first:**
- Similar feature exists → dispatch codebase-investigator
- New integration → dispatch internet-researcher
- Review findings before proposing

**IMPORTANT: Capture research findings for Design Rationale**
As you research, note down:
- Codebase findings: file paths, patterns discovered, relevant code
- External findings: API capabilities, library constraints, doc URLs
- These will populate the "Research Findings" section of the epic

**Propose 2-3 approaches with trade-offs:**

```
Based on [research findings], I recommend:

1. **[Approach A]** (recommended)
   - Pros: [benefits, especially "matches existing pattern"]
   - Cons: [drawbacks]

2. **[Approach B]**
   - Pros: [benefits]
   - Cons: [drawbacks]

3. **[Approach C]**
   - Pros: [benefits]
   - Cons: [drawbacks]

I recommend option 1 because [specific reason, especially codebase consistency].
```

**Lead with recommended option and explain why.**

---

## 3. Presenting the Design

**Once approach is chosen, present design in sections:**
- Break into 200-300 word chunks
- Ask after each: "Does this look right so far?"
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify

**Show research findings:**
- "Based on codebase investigation: auth/ uses passport.js..."
- "API docs show OAuth flow requires..."
- Demonstrate how design builds on existing code

---

## 4. Creating the bd Epic

**After design validated, create epic as immutable contract:**

```bash
bd create "Feature: [Feature Name]" \
  --type epic \
  --priority [0-4] \
  --design "## Requirements (IMMUTABLE)
[What MUST be true when complete - specific, testable]
- Requirement 1: [concrete requirement]
- Requirement 2: [concrete requirement]
- Requirement 3: [concrete requirement]

## Success Criteria (MUST ALL BE TRUE)
- [ ] Criterion 1 (objective, testable - e.g., 'Integration tests pass')
- [ ] Criterion 2 (objective, testable - e.g., 'Works with existing User model')
- [ ] All tests passing
- [ ] Pre-commit hooks passing

## Anti-Patterns (FORBIDDEN)
- ❌ [Pattern] ([reasoning] - e.g., 'NO localStorage tokens (security: httpOnly prevents XSS token theft)')
- ❌ [Pattern] ([reasoning] - e.g., 'NO mocking OAuth in integration tests (validation: defeats purpose)')

## Approach
[2-3 paragraph summary of chosen approach]

## Architecture
[Key components, data flow, integration points]

## Design Rationale
### Problem
[1-2 sentences: what problem this solves, why status quo insufficient]

### Research Findings
**Codebase:**
- [file.ts:line] - [what it does, why relevant]
- [pattern discovered, implications]

**External:**
- [API/library] - [key capability, constraint discovered]
- [doc URL] - [relevant guidance found]

### Approaches Considered
1. **[Chosen Approach]** ✓
   - Pros: [benefits]
   - Cons: [drawbacks]
   - **Chosen because:** [specific reasoning, especially codebase consistency]

2. **[Rejected Approach A]**
   - Pros: [benefits]
   - Cons: [drawbacks]
   - **Rejected because:** [specific reasoning]

3. **[Rejected Approach B]** (if applicable)
   - Pros: [benefits]
   - Cons: [drawbacks]
   - **Rejected because:** [specific reasoning]

### Scope Boundaries
**In scope:**
- [explicit inclusions]

**Out of scope (deferred/never):**
- [explicit exclusions with reasoning]

### Open Questions
- [uncertainties to resolve during implementation]
- [decisions deferred to execution phase]"
```

**Critical:** Anti-patterns section prevents watering down requirements when blockers occur. Always include reasoning.

**Example anti-patterns:**
- ❌ NO localStorage tokens (security: httpOnly prevents XSS token theft)
- ❌ NO new user model (consistency: must integrate with existing db/models/user.ts)
- ❌ NO mocking OAuth in integration tests (validation: defeats purpose of testing real flow)
- ❌ NO TODO stubs for core authentication flow (completeness: core flow must be implemented)

---

## 5. Creating ONLY First Task

**Create one task, not full tree:**

```bash
bd create "Task 1: [Specific Deliverable]" \
  --type feature \
  --priority [match-epic] \
  --design "## Goal
[What this task delivers - one clear outcome]

## Implementation
[Detailed step-by-step for this task]

1. Study existing code
   [Point to 2-3 similar implementations: file.ts:line]

2. Write tests first (TDD)
   [Specific test cases for this task]

3. Implementation checklist
   - [ ] file.ts:line - function_name() - [exactly what it does]
   - [ ] test.ts:line - test_name() - [what scenario it tests]

## Success Criteria
- [ ] [Specific, measurable outcome]
- [ ] Tests passing
- [ ] Pre-commit hooks passing"

bd dep add bd-2 bd-1 --type parent-child  # Link to epic
```

**Why only one task?**
- Subsequent tasks created iteratively by executing-plans
- Each task reflects learnings from previous
- Avoids brittle task trees that break when assumptions change

---

## 6. SRE Refinement and Handoff

After epic and first task created:

**REQUIRED: Run SRE refinement before handoff**

```
Use Skill tool: hyperpowers:sre-task-refinement
```

SRE refinement will:
- Apply 7-category corner-case analysis (Opus 4.1)
- Strengthen success criteria
- Identify edge cases and failure modes
- Ensure task is ready for implementation

**Do NOT skip SRE refinement.** The first task sets the pattern for the entire epic.

**After refinement approved, present handoff:**

```
"Epic bd-1 is ready with immutable requirements and success criteria.
First task bd-2 has been refined and is ready to execute.

Ready to start implementation? I'll use executing-plans to work through this iteratively.

The executing-plans skill will:
1. Execute the current task
2. Review what was learned against epic requirements
3. Create next task based on current reality
4. Run SRE refinement on new tasks
5. Repeat until all epic success criteria met

This approach avoids brittle upfront planning - each task adapts to what we learn."
```
</the_process>

<examples>
<example>
<scenario>Developer skips research, proposes approach without checking codebase</scenario>

<code>
User: "Add OAuth authentication"

Claude (without brainstorming):
"I'll implement OAuth with Auth0..."
[Proposes approach without checking if auth exists]
[Doesn't research existing patterns]
[Misses that passport.js already set up]
</code>

<why_it_fails>
- Proposes Auth0 when passport.js already exists in codebase
- Creates inconsistent architecture (two auth systems)
- Wastes time implementing when partial solution exists
- Doesn't leverage existing code
- User has to redirect to existing pattern
</why_it_fails>

<correction>
**Correct approach:**

1. **Research first:**
   - Dispatch codebase-investigator: "Find existing auth implementation"
   - Findings: passport.js at auth/passport-config.ts
   - Dispatch internet-researcher: "Passport OAuth2 strategies"

2. **Propose approaches building on findings:**
   ```
   Based on codebase showing passport.js at auth/passport-config.ts:

   1. Extend existing passport setup (recommended)
      - Add google-oauth20 strategy
      - Matches codebase pattern
      - Pros: Consistent, tested library
      - Cons: Requires OAuth provider setup

   2. Custom JWT implementation
      - Pros: Full control
      - Cons: Security complexity, breaks pattern

   I recommend option 1 because it builds on existing auth/ setup.
   ```

**What you gain:**
- Leverages existing code (faster)
- Consistent architecture (maintainable)
- Research informs design (correct)
- User sees you understand codebase (trust)
</correction>
</example>

<example>
<scenario>Developer creates full task tree upfront</scenario>

<code>
bd create "Epic: Add OAuth"
bd create "Task 1: Configure OAuth provider"
bd create "Task 2: Implement token exchange"
bd create "Task 3: Add refresh token logic"
bd create "Task 4: Create middleware"
bd create "Task 5: Add UI components"
bd create "Task 6: Write integration tests"

# Starts implementing Task 1
# Discovers OAuth library handles refresh automatically
# Now Task 3 is wrong, needs deletion
# Discovers middleware already exists
# Now Task 4 is wrong
# Task tree brittle to reality
</code>

<why_it_fails>
- Assumptions about implementation prove wrong
- Task tree becomes incorrect as you learn
- Wastes time updating/deleting wrong tasks
- Rigid plan fights with reality
- Context switching between fixing plan and implementing
</why_it_fails>

<correction>
**Correct approach (iterative):**

```bash
bd create "Epic: Add OAuth" [with immutable requirements]
bd create "Task 1: Configure OAuth provider"

# Execute Task 1
# Learn: OAuth library handles refresh, middleware exists

bd create "Task 2: Integrate with existing middleware"
# [Created AFTER learning from Task 1]

# Execute Task 2
# Learn: UI needs OAuth button component

bd create "Task 3: Add OAuth button to login UI"
# [Created AFTER learning from Task 2]
```

**What you gain:**
- Tasks reflect current reality (accurate)
- No wasted time fixing wrong plans (efficient)
- Each task informed by previous learnings (adaptive)
- Plan evolves with understanding (flexible)
- Epic requirements stay immutable (contract preserved)
</correction>
</example>

<example>
<scenario>Epic created without anti-patterns section</scenario>

<code>
bd create "Epic: OAuth Authentication" --design "
## Requirements
- Users authenticate via Google OAuth2
- Tokens stored securely
- Session management

## Success Criteria
- [ ] Login flow works
- [ ] Tokens secured
- [ ] All tests pass
"

# During implementation, hits blocker:
# "Integration tests for OAuth are complex, I'll mock it..."
# [No anti-pattern preventing this]
# Ships with mocked OAuth (defeats validation)
</code>

<why_it_fails>
- No explicit forbidden patterns
- Agent rationalizes shortcuts when blocked
- "Tokens stored securely" too vague (localStorage? cookies?)
- Requirements can be "met" without meeting intent
- Mocking defeats the purpose of integration tests
</why_it_fails>

<correction>
**Correct approach with anti-patterns and design rationale:**

```bash
bd create "Epic: OAuth Authentication" --design "
## Requirements (IMMUTABLE)
- Users authenticate via Google OAuth2
- Tokens stored in httpOnly cookies (NOT localStorage)
- Session expires after 24h inactivity
- Integrates with existing User model at db/models/user.ts

## Success Criteria
- [ ] Login redirects to Google and back
- [ ] Tokens in httpOnly cookies
- [ ] Token refresh works automatically
- [ ] Integration tests pass WITHOUT mocking OAuth
- [ ] All tests passing

## Anti-Patterns (FORBIDDEN)
- ❌ NO localStorage tokens (security: httpOnly prevents XSS token theft)
- ❌ NO new user model (consistency: must use existing db/models/user.ts)
- ❌ NO mocking OAuth in integration tests (validation: defeats purpose of testing real flow)
- ❌ NO skipping token refresh (completeness: explicit requirement from user)

## Approach
Extend existing passport.js setup at auth/passport-config.ts with Google OAuth2 strategy.
Use passport-google-oauth20 library. Store tokens in httpOnly cookies via express-session.
Integrate with existing User model for profile storage.

## Architecture
- auth/strategies/google.ts - New OAuth strategy
- auth/passport-config.ts - Register strategy (existing)
- db/models/user.ts - Add googleId field (existing)
- routes/auth.ts - OAuth callback routes

## Design Rationale
### Problem
Users currently have no SSO option - must create accounts manually.
Manual signup has 40% abandonment rate. Google OAuth reduces friction.

### Research Findings
**Codebase:**
- auth/passport-config.ts:1-50 - Existing passport setup, uses session-based auth
- auth/strategies/local.ts:1-30 - Pattern for adding strategies
- db/models/user.ts:1-80 - User model, already has email field

**External:**
- passport-google-oauth20 - Official Google strategy, 2M weekly downloads
- Google OAuth2 docs - Requires client ID, callback URL, scopes

### Approaches Considered
1. **Extend passport.js with google-oauth20** ✓
   - Pros: Matches existing pattern, well-documented, session reuse
   - Cons: Adds dependency
   - **Chosen because:** Consistent with auth/strategies/local.ts pattern

2. **Custom JWT-based OAuth**
   - Pros: No new dependencies, full control
   - Cons: Security complexity, breaks existing session pattern
   - **Rejected because:** Inconsistent with codebase, security risk

3. **Auth0 integration**
   - Pros: Managed service, multiple providers
   - Cons: External dependency, cost, different auth model
   - **Rejected because:** Overkill for single provider, introduces new pattern

### Scope Boundaries
**In scope:**
- Google OAuth login/signup
- Token storage in httpOnly cookies
- Profile sync with User model

**Out of scope (deferred/never):**
- Other OAuth providers (GitHub, Facebook) - deferred to future epic
- Account linking (connect Google to existing account) - deferred
- Custom OAuth scopes beyond profile/email - not needed

### Open Questions
- Should failed OAuth create partial user record? (decide during implementation)
- Token refresh: silent vs prompt? (default to silent, user can configure)
"
```

**What you gain:**
- Requirements concrete and specific (testable)
- Forbidden patterns explicit with reasoning (prevents shortcuts)
- Agent can't rationalize away requirements (contract enforced)
- Design rationale preserves context for future tasks
- Approaches considered show why alternatives were rejected
- Open questions explicitly tracked for implementation decisions
</correction>
</example>
</examples>

<key_principles>
- **One question at a time** - Don't overwhelm
- **Multiple choice preferred** - Easier to answer when possible
- **Delegate research** - Use codebase-investigator and internet-researcher agents
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Epic is contract** - Requirements immutable, tasks adapt
- **Anti-patterns prevent shortcuts** - Explicit forbidden patterns stop rationalization
- **One task only** - Subsequent tasks created iteratively (not upfront)
</key_principles>

<research_agents>
## Use codebase-investigator when:
- Understanding how existing features work
- Finding where specific functionality lives
- Identifying patterns to follow
- Verifying assumptions about structure
- Checking if feature already exists

## Use internet-researcher when:
- Finding current API documentation
- Researching library capabilities
- Comparing technology options
- Understanding community recommendations
- Finding official code examples

## Research protocol:
1. Codebase pattern exists → Use it (unless clearly unwise)
2. No codebase pattern → Research external patterns
3. Research yields nothing → Ask user for direction
</research_agents>

<critical_rules>
## Rules That Have No Exceptions

1. **Use AskUserQuestion tool** → Don't just print questions and wait
2. **Research BEFORE proposing** → Use agents to understand context
3. **Propose 2-3 approaches** → Don't jump to single solution
4. **Epic requirements IMMUTABLE** → Tasks adapt, requirements don't
5. **Include anti-patterns section** → Prevents watering down requirements
6. **Create ONLY first task** → Subsequent tasks created iteratively
7. **Run SRE refinement** → Before handoff to executing-plans

## Common Excuses

All of these mean: **STOP. Follow the process.**

- "Requirements obvious, don't need questions" (Questions reveal hidden complexity)
- "I know this pattern, don't need research" (Research might show better way)
- "Can plan all tasks upfront" (Plans become brittle, tasks adapt as you learn)
- "Anti-patterns section overkill" (Prevents rationalization under pressure)
- "Epic can evolve" (Requirements contract, tasks evolve)
- "Can just print questions" (Use AskUserQuestion tool - it's more interactive)
- "SRE refinement overkill for first task" (First task sets pattern for entire epic)
- "User said yes, design is done" (Still need SRE refinement before execution)
</critical_rules>

<verification_checklist>
Before handing off to executing-plans:

- [ ] Used AskUserQuestion tool for clarifying questions (one at a time)
- [ ] Researched codebase patterns (if applicable)
- [ ] Researched external docs/libraries (if applicable)
- [ ] Proposed 2-3 approaches with trade-offs
- [ ] Presented design in sections, validated each
- [ ] Created bd epic with all sections (requirements, success criteria, anti-patterns, approach, architecture, design rationale)
- [ ] Requirements are IMMUTABLE and specific
- [ ] Anti-patterns include reasoning (not just "NO X" but "NO X (reason: Y)")
- [ ] Design Rationale complete: problem, research findings, approaches considered, scope boundaries, open questions
- [ ] Created ONLY first task (not full tree)
- [ ] First task has detailed implementation checklist
- [ ] Ran SRE refinement on first task (hyperpowers:sre-task-refinement)
- [ ] Announced handoff to executing-plans after refinement approved

**Can't check all boxes?** Return to process and complete missing steps.
</verification_checklist>

<integration>
**This skill calls:**
- hyperpowers:codebase-investigator (for finding existing patterns)
- hyperpowers:internet-researcher (for external documentation)
- hyperpowers:sre-task-refinement (REQUIRED before handoff to executing-plans)
- hyperpowers:executing-plans (handoff after refinement approved)

**Call chain:**
```
brainstorming → sre-task-refinement → executing-plans
```

**This skill is called by:**
- hyperpowers:using-hyper (mandatory before writing code)
- User requests for new features
- Beginning of greenfield development

**Agents used:**
- codebase-investigator (understand existing code)
- internet-researcher (find external documentation)

**Tools required:**
- AskUserQuestion (for all clarifying questions)
</integration>

<resources>
**Detailed guides:**
- [bd epic template examples](resources/epic-templates.md)
- [Socratic questioning patterns](resources/questioning-patterns.md)
- [Anti-pattern examples by domain](resources/anti-patterns.md)

**When stuck:**
- User gives vague answer → Ask follow-up multiple choice question
- Research yields nothing → Ask user for direction explicitly
- Too many approaches → Narrow to top 2-3, explain why others eliminated
- User changes requirements mid-design → Acknowledge, return to understanding phase
</resources>

