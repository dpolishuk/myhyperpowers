# Refactor Patterns and Choices

Use this mapping to pick refactor patterns that target specific smells.

| Smell/Trap | Pattern/Refactor | Notes |
|---|---|---|
| Duplicated Code | Extract Method / Extract Class | Consolidate into shared unit |
| Long Method | Extract Method | Keep behavior identical |
| Large Class | Extract Class / Extract Module | Split by responsibility |
| Long Parameter List | Introduce Parameter Object | Encapsulate related data |
| Feature Envy | Move Method | Place behavior with data |
| Data Clumps | Introduce Value Object | Create domain type |
| Primitive Obsession | Replace Primitive with Object | Add invariants to type |
| Conditional Logic Explosion | Replace Conditional with Polymorphism | Prefer composition of strategies |
| Message Chains | Hide Delegate | Add facade method |
| Inappropriate Intimacy | Extract Interface / Reduce Visibility | Create stable API |
| Speculative Generality | Inline Class / Remove Parameter | Delete unused paths |
| Middle Man | Remove Middle Man | Simplify call path |
| Parallel Inheritance | Replace Inheritance with Delegation | Composition over inheritance |
| Leaky Abstraction | Introduce Interface | Move low-level details downward |
| Global Mutable State | Encapsulate State + DI | Single owner + injection |
| Temporal Coupling | Encapsulate Sequence | Provide single method or type state machine |
| Inconsistent Error Handling | Introduce Result/Error Type | Standardize error flow |

## Composition First
Default to composition. Use inheritance only when the subtype truly models an "is-a" relationship and the base class is stable.

## DI Checklist
- Identify side-effecting dependencies (I/O, network, clocks, randomness)
- Define interfaces and default implementations
- Inject dependencies at construction or call boundary
- Provide test doubles for error simulation
