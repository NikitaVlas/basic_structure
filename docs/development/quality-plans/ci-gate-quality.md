# CI gate quality plan

## Verification summary

- `npm.cmd test`: 68 tests, 67 passed, 1 skipped because this Windows host
  disallows symlink creation; no failures.
- `npm.cmd run verify`: passed with 79 documentation files, 12 extensions, 6
  presets, and 5 policies.
- Real CLI smoke generated an 81-managed-file documentation project; clean
  drift and gate checks passed. A controlled `AGENTS.md` edit then produced
  `DRIFT_DETECTED` and `GATE_FAILED`, both with exit code `5` and exact evidence.
- The dedicated GitHub Actions workflow runs gate, policy, CLI regression tests,
  and full template catalog verification.

## Coverage

- fresh-project drift and gate success;
- managed file modification evidence;
- config, state, policies, environment, reports, and verification aggregation;
- stable JSON and exit code `5`;
- read-only behavior;
- dedicated GitHub Actions regression workflow.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
