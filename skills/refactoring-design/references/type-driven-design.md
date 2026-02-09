# Type-Driven Design Guidance

## Make Invalid States Unrepresentable
Encode invariants in types so invalid combinations cannot be constructed.

Examples:
- Use enums instead of booleans with unclear meaning
- Use value objects for validated data (Email, UserId)
- Separate "Pending" vs "Active" states into distinct types

## Parse, Don't Validate
At boundaries, parse inputs into validated domain types. Downstream code should only accept validated types, not raw strings.

Boundary checklist:
- Validate and construct domain types at API boundaries
- Convert external errors into explicit error types
- Avoid re-validating the same data multiple times

## Error Types
- Prefer explicit error enums or classes
- Include only actionable error variants
- Avoid stringly-typed errors for core logic
