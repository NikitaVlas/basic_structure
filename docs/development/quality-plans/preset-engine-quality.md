# Preset engine quality plan

## Coverage

- inheritance, deterministic merge, cycles, and profile conflicts;
- semantic constraints and recursive extension requirements;
- preset initialization and clean generated state;
- additive diff/apply and exact prune behavior;
- transactional files, configuration, state, report, and rollback reuse;
- human and JSON CLI contracts;
- catalog validation in template verification.

## Verification summary

- `npm.cmd test`: 57 tests, 56 passed, 1 skipped because this Windows host
  disallows symlink creation; no failures.
- `npm.cmd run verify`: passed with 70 documentation files, 12 extensions, and
  all 6 resolved presets.
- Real CLI smoke initialized a 95-managed-file `fullstack-minimal` project,
  diffed and applied `saas` additively, passed `doctor`, converged exactly back
  to `fullstack-minimal` with `--prune`, passed `doctor` again, and ended with a
  clean update plan.
- Automated tests cover catalog resolution, inheritance lineage, recursive
  requirements, SemVer constraints, initialization, additive preservation,
  exact transactional pruning, and CLI JSON evidence.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
