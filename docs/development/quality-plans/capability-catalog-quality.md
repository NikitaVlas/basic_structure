# Capability catalog quality plan

## Coverage

- metadata grammar, uniqueness, maturity, and built-in completeness;
- extension and inherited preset search;
- kind filters and resolved inspection evidence;
- deterministic provider selection and dependency closure;
- compatible minimal composition and preset ranking;
- uncovered capability reporting;
- human and JSON CLI contracts.

## Verification summary

- `npm.cmd test`: 61 tests, 60 passed, 1 skipped because this Windows host
  disallows symlink creation; no failures.
- `npm.cmd run verify`: passed with 73 documentation files, 12 extensions, and
  6 presets; built-in catalog completeness is part of verification.
- Real CLI smoke searched `auth`, inspected `module:auth-session` and
  `preset:saas`, then recommended authentication plus database for
  `fullstack-web`. The result resolved a compatible seven-extension composition
  and ranked `preset:saas` first.
- Automated tests cover kind filtering, inherited capability aggregation,
  requirements evidence, deterministic providers, dependency closure, preset
  ranking, uncovered capabilities, and JSON contracts.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
