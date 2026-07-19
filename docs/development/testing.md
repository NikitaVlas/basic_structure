# Testing strategy

## Objectives

Define the risks the project's test suite must control.

## Unit tests

Test business rules and isolated deterministic logic.

## Integration tests

Test databases, file systems, adapters, framework integration, and boundaries.

## Contract tests

Test public APIs, schemas, messages, and external integration assumptions.

## E2E tests

Test critical user journeys through production-like boundaries.

## Visual tests

When UI exists, test key states and supported viewports against approved design.

## Manual tests

Use only when automation is disproportionate or cannot establish confidence.

## Regression policy

A reproducible bug fix must include a regression test when technically feasible.

## Test matrix

| Change | Minimum expected test |
|---|---|
| Business rule | Unit |
| Database query or repository | Integration |
| API endpoint or event | Integration and/or contract |
| Critical user flow | E2E |
| Bug fix | Regression |
| Migration | Migration integration |
| UI state | Component and/or E2E |
| Visual change | Screenshot comparison |
| Authentication or permissions | Integration plus negative cases |
| External integration | Contract plus failure behavior |

## Test rules

- Test observable behavior, not incidental implementation details.
- Do not remove tests to make CI pass.
- Do not silently weaken assertions.
- Include negative cases for critical operations.
- Keep tests independent and reproducible.
- Control time, randomness, network access, and shared state.
- Keep fixtures free of real secrets and sensitive production data.

## Document status

- Status: Draft
- Owner:
- Last reviewed:
- Related code: Test suites

