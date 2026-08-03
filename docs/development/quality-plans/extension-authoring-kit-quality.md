# Extension authoring kit quality plan

## Scope

Scaffolding, static validation, and isolated integration testing for local
profiles, modules, and adapters.

## Coverage matrix

| Acceptance area | Evidence |
|---|---|
| Deterministic scaffolds for every kind | Authoring unit tests |
| Refusal to overwrite and strict identity validation | Negative tests |
| Manifest and fixture selection validation | Static validation tests |
| Generation and clean upgrade plan | Isolated integration tests |
| Module and adapter remove/add round-trip | Transactional integration tests |
| Human and JSON CLI contracts | CLI tests |
| Documentation and schema integrity | Template verification |

## Verification summary

- `npm.cmd test`: 52 tests, 51 passed, 1 skipped because this Windows host
  disallows symlink creation; no failures.
- `npm.cmd run verify`: passed in template mode with 67 documentation files
  and 12 permanent extensions.
- Real CLI smoke created `module:authoring-smoke`, validated its fixture, and
  completed an isolated 69-managed-file remove/add round-trip with a clean
  final plan. The temporary scaffold was removed afterward.
- Automated tests cover all three kinds, strict identities, atomic overwrite
  refusal, fixture mismatch, static resolution, isolated initialization,
  module and adapter round-trips, and JSON error/success envelopes.

## Known limitations

- Scaffolds intentionally contain no product-specific runtime implementation.
- Profile extension tests do not infer a reversible source profile.
- Package installation and runtime-specific tests remain author-owned.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/extension-authoring-kit-design.md`
