# CI drift and policy gate design

## Decision

`drift check` performs strict read-only comparison of managed files,
configuration, state, and selected extension versions against the current
starter. Any status other than unchanged is drift.

`gate check` and `gate explain` aggregate drift, configuration, state, harness
policies, required environment probes, unfinished lifecycle reports, and the
verification entry point. Required failures return exit code `5` and one stable
JSON report.

The gate never writes baselines, applies updates, remediates policies, executes
project verification, installs tools, or modifies Git state.

## Acceptance criteria

1. A freshly generated project passes.
2. Modified, missing, introduced, conflicted, or version-drifted managed state
   fails with exact evidence.
3. Policy violations are included without losing their details.
4. Unfinished operations and invalid state fail closed.
5. Optional non-applicable checks remain skip.
6. Human and JSON output use stable check identifiers and exit code `5`.
7. CI runs gate regression tests and template catalog verification.

## Document status

- Status: Implemented
- Owner: Project maintainers
- Last reviewed: 2026-08-03

