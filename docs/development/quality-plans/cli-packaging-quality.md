# CLI packaging quality plan

## Verification summary

- `npm.cmd test`: 69 tests, 68 passed, 1 skipped because this Windows host
  disallows symlink creation; no failures.
- `npm.cmd run verify`: passed with 82 documentation files, 12 extensions, 6
  presets, and 5 policies.
- `npm.cmd run package:check`: packed 263 allowlisted files, installed
  `@basic-structure/cli@0.1.0` from the local tarball in an empty consumer, and
  passed packaged `version`, `list-presets`, `init`, and `gate check` commands.
- Provenance tests confirm a deterministic 64-hex-character SHA-256 catalog
  digest and supported schema declarations.

## Coverage

- publish allowlist, forbidden paths, and required catalog contents;
- deterministic SHA-256 provenance;
- actual tarball installation in an empty consumer;
- packaged version, list, init, and gate commands;
- exact generated-project dependency and CI gate script;
- repository regression and template verification.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
