# Test Smell Catalog

| Test Smell | Symptoms | Risk | Suggested Fix |
|---|---|---|---|
| Assertion Roulette | Many assertions with no clear failure message | Hard to debug failures | Split tests or add clear messages |
| Eager Test | One test covers too many behaviors | Fragile, unclear purpose | Split into focused tests |
| Mystery Guest | Hidden external data or fixtures | Non-determinism | Inline or explicitly declare fixtures |
| General Fixture | Shared setup for unrelated tests | Wasted setup, unclear dependencies | Create focused fixtures |
| Conditional Test Logic | if/else inside tests | Paths untested | Split into separate tests |
| Interdependent Tests | Tests rely on order or shared state | Flaky tests | Isolate state, reset fixtures |
| Slow Tests | Excessive integration in unit tests | Slow feedback | Mock boundaries or create smaller tests |
| Overspecified Mocks | Tests validate internal calls, not behavior | Refactor breaks tests | Assert on behavior, reduce mock expectations |
| Testing Implementation Details | Tests rely on private structure | Fragile to refactor | Test public behavior only |
| Hidden Assertion | Assertions buried in helpers | Hard to see intent | Make assertions explicit |
