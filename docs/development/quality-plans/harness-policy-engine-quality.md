# Harness policy engine quality plan

## Verification summary

- `npm.cmd test`: 65 tests, 64 passed, 1 skipped because this Windows host
  disallows symlink creation; no failures.
- `npm.cmd run verify`: passed with 76 documentation files, 12 extensions, 6
  presets, and all 5 policies.
- Fresh documentation and security-hardened production fixtures passed every
  applicable policy. Removing `AGENTS.md` produced an exact regular-file
  violation and CLI exit code `4`.
- Real CLI smoke covered list, explain, compliant check, and fail-closed
  remediation refusal on a project with starter drift.

## Coverage

- deterministic catalog and policy validation;
- applicability and pass/fail/skip semantics;
- capability, regular-file, and package-script evidence;
- production and AI harness fixtures;
- violation JSON and exit code `4`;
- plan-first preset remediation and drift blocking.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
