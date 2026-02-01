# Common Anti-Patterns

Anti-patterns that apply across multiple skills. Reference this to avoid duplication.

## Language-Specific Anti-Patterns

### Rust

```
❌ No unwrap() or expect() in production code
   Use proper error handling with Result/Option

❌ No todo!(), unimplemented!(), or panic!() in production
   Implement all code paths properly

❌ No #[ignore] on tests without bd issue number
   Fix or track broken tests

❌ No unsafe blocks without documentation
   Document safety invariants

❌ Use proper array bounds checking
   Prefer .get() over direct indexing in production
```

### Swift

```
❌ No force unwrap (!) in production code
   Use optional chaining or guard/if let

❌ No fatalError() in production code
   Handle errors gracefully

❌ No disabled tests without bd issue number
   Fix or track broken tests

❌ Use proper array bounds checking
   Check indices before accessing

❌ Handle all enum cases
   No default: fatalError() shortcuts
```

### TypeScript

```
❌ No @ts-ignore or @ts-expect-error without bd issue number
   Fix type issues properly

❌ No any types without justification
   Use proper typing

❌ No .skip() on tests without bd issue number
   Fix or track broken tests

❌ No throw in async code without proper handling
   Use try/catch or Promise.catch()
```

## General Anti-Patterns

### Code Quality

```
❌ No TODOs or FIXMEs without bd issue numbers
   Track work in bd, not in code comments

❌ No stub implementations
   Empty functions, placeholder returns forbidden

❌ No commented-out code
   Delete it - version control remembers

❌ No debug print statements in commits
   Remove console.log, println!, print() before committing

❌ No "we'll do this later"
   Either do it now or create bd issue and reference it
```

### Testing

```
❌ Don't test mock behavior
   Test real behavior or unmock it

❌ Don't add test-only methods to production code
   Put in test utilities instead

❌ Don't mock without understanding dependencies
   Understand what you're testing first

❌ Don't skip verifications
   Run the test, see the output, then claim it passes
```

### Process

```
❌ Don't commit without running tests
   Verify tests pass before committing

❌ Don't create PR without running full test suite
   All tests must pass before PR creation

❌ Don't skip pre-commit hooks
   Never use --no-verify

❌ Don't force push without explicit request
   Respect shared branch history

❌ Don't assume backwards compatibility is desired
   Ask if breaking changes are acceptable
```

## Refactoring Anti-Patterns

After refactoring, old code is dead code. Delete it.

```
❌ No fallback code after refactoring
   Old implementation should be DELETED, not kept as fallback
   - If new code works, old code is unnecessary
   - If new code doesn't work, fix it - don't keep old code "just in case"

❌ No "use old/legacy" conditionals
   Feature flags for old implementations = incomplete refactoring
   - USE_LEGACY_*, ENABLE_OLD_*, FALLBACK_TO_*
   - if (useLegacy) { oldImplementation() }
   - These should trigger immediate deletion of old code

❌ No backwards compatibility shims (unless external API)
   Internal code doesn't need backwards compatibility
   - Shims for internal callers = incomplete migration
   - Fix all callers, then delete the shim
   - Only external APIs may need temporary backwards compat

❌ No orphaned tests
   Tests must test current functionality, not removed code
   - Tests for deleted functions = orphaned tests
   - Tests importing removed modules = orphaned tests
   - Delete or update these tests

❌ No deprecation markers without timeline
   Either remove now or create bd issue with removal date
   - @deprecated without action = "keep forever"
   - Every @deprecated needs: bd issue + removal date
   - If no external consumers, just delete it now

❌ No "V2" without removing V1
   Version suffixes = incomplete migration
   - authenticateV2() means authenticate() is dead
   - Rename V2 to the canonical name after migration
   - Delete all Vn-1 variants
```

## Project-Specific Additions

Each project may have additional anti-patterns. Check CLAUDE.md for:
- Project-specific code patterns to avoid
- Custom linting rules
- Framework-specific anti-patterns
- Team conventions
