# Composition change engine quality plan

## Scope

Safe module and adapter add/remove planning and transactional application.

## Threat model

CLI arguments, project configuration, state, destination files, and manifests
are untrusted inputs. The engine validates identities, requires a synchronized
baseline, resolves only local manifests, rejects implicit destructive cascades,
and reuses path, symlink, backup, and rollback protections.

## Coverage matrix

| Acceptance area | Evidence |
|---|---|
| Recursive add requirements | Composition unit/integration tests |
| Conflict and profile requirements | Negative composition tests |
| Reverse dependency removal gate | Negative composition tests |
| Contributions and package dependency recomposition | Full-stack add/remove assertions |
| Plan read-only behavior | Config/state/file snapshot assertions |
| Transactional config/file/state apply | Apply and rollback tests |
| Modified retired and occupied paths | Upgrade conflict tests |
| Human and JSON CLI contracts | CLI composition tests |

## Verification summary

- `npm.cmd test`: 43 tests, 42 passed, 1 skipped because this Windows host
  disallows symlink creation; no failures.
- `npm.cmd run verify`: passed in template mode with 61 documentation files
  and 12 extensions.
- Real CLI smoke: initialized a 176-file full-stack project, planned and applied
  removal of `module:e2e-playwright`, passed `doctor`, planned and applied the
  add, passed `doctor` again, and finished with an empty update plan.
- Automated coverage verifies recursive requirements, read-only plans,
  dependency gates, occupied and modified path conflicts, config/file/state
  rollback, backups, contribution recomposition, and CLI contracts.

## Known limitations

- Profile changes and automatic cascading removal are excluded.
- Dependency installation and lockfile refresh remain explicit operator steps.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/composition-change-engine-design.md`
