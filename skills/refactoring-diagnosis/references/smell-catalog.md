# Code and Design Smell Catalog

Use this catalog to map concrete evidence to smells and likely refactor directions. Smells are signals, not proof.

| Smell/Trap | Symptoms | Risk | Refactor Direction | Tests to Add |
|---|---|---|---|---|
| Duplicated Code | Same logic repeated across functions/classes | Divergent fixes, bug replication | Extract method/class, consolidate logic | Characterization tests for shared behavior |
| Long Method | Function does too many things | Hard to reason, high bug risk | Extract method, introduce cohesive helpers | Unit tests per extracted behavior |
| Large Class (God Class) | Many responsibilities in one class | Tight coupling, low reuse | Split by responsibility, introduce facades | Tests per new component |
| Long Parameter List | Many args, unclear invariants | Call-site errors, misordered args | Introduce parameter object or builder | Construction tests for invalid combos |
| Divergent Change | Single class changed for many reasons | High churn, unstable | Split by reason-to-change | Regression tests per concern |
| Shotgun Surgery | One change requires edits everywhere | Fragile, expensive maintenance | Centralize behavior, introduce abstractions | Integration tests around single change point |
| Feature Envy | Method uses data from another class | Wrong ownership, hidden coupling | Move method to data owner | Tests validating moved behavior |
| Data Clumps | Same groups of fields passed together | Duplication, inconsistency | Create value object | Equality and invariants tests |
| Primitive Obsession | Overuse of strings/ints for domain types | Invalid states, parsing bugs | Introduce domain types | Parsing/invariant tests |
| Conditional Logic Explosion | Large if/else or switch | Hard to extend, bug-prone | Replace conditional with polymorphism | Tests per variant/subtype |
| Message Chains (Train Wreck) | obj.a().b().c() | Tight coupling to internals | Hide delegation, introduce method | Tests on new facade methods |
| Inappropriate Intimacy | Classes poking into each other | Tight coupling | Extract class, reduce access | Tests for new interfaces |
| Temporary Field | Field only used sometimes | Confusing state, invalid combos | Extract class or subclass | State-specific tests |
| Speculative Generality | Hooks for features that don't exist | Unused complexity | Remove or simplify | Remove dead code tests |
| Lazy Class | Class does too little | Overhead without benefit | Inline class | Tests for inlined behavior |
| Middle Man | Class only delegates | Redundant layer | Remove middle man | Tests for direct interactions |
| Parallel Inheritance Hierarchies | New class in one hierarchy forces another | Rigid structure | Replace with composition | Tests for composed collaborators |
| Leaky Abstraction | Low-level details exposed at high level | Incorrect layering | Introduce proper interface | Tests for interface contract |
| Anemic Domain Model | Behavior outside data objects | Scattered rules | Move behavior into domain objects | Domain behavior tests |
| Hidden Side Effects | Methods mutate unrelated state | Surprising behavior | Separate commands/queries | Tests for side-effect boundaries |
| Temporal Coupling | Methods must be called in order | Fragile usage | Encapsulate sequence | Tests for invalid order |
| Global Mutable State | Shared state accessed everywhere | Non-determinism | Encapsulate state, DI | Concurrency and isolation tests |
| Inconsistent Error Handling | Mixed error styles or ignored errors | Unhandled failures | Standardize error types | Error-path tests |
