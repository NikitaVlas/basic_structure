# Profile migration quality plan

## Scope

Safe migration between local project profiles through the lifecycle CLI.

## Coverage matrix

| Acceptance area | Evidence |
|---|---|
| Read-only planning and same-profile rejection | Unit tests |
| Required extension addition | Migration integration tests |
| Direct and transitive incompatibility pruning | Negative and apply tests |
| Modified retired and occupied new paths | Three-way conflict assertions |
| Config/file/state transaction and rollback | Apply fault-injection tests |
| Human and JSON contracts | CLI tests |
| Generated-project health | Real switch and doctor smoke |

## Verification summary

- `npm.cmd test`: 48 tests, 47 passed, 1 skipped because this Windows host
  disallows symlink creation; no failures.
- `npm.cmd run verify`: passed in template mode with 64 documentation files
  and 12 extensions.
- Real CLI smoke initialized a 66-file documentation project, planned and
  applied `documentation-only -> fullstack-web`, passed `doctor`, planned and
  applied the reverse migration, passed `doctor` again, and ended with an empty
  update plan.
- Automated tests cover automatic profile requirements, surface replacement,
  deterministic direct/transitive prune gates, explicit prune apply, modified
  retired files, configuration/file/state backup and rollback, CLI help and
  JSON evidence, and read-only plans.

## Known limitations

- Application data migrations remain operator-owned.
- Dependency installation and lockfile refresh are explicit follow-up actions.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/profile-migration-design.md`
