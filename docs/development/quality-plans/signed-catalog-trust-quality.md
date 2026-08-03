# Signed catalog trust quality plan

## Verification summary

- `npm.cmd test`: 73 tests, 72 passed, 1 skipped because this Windows host
  disallows symlink creation; no failures.
- `npm.cmd run verify`: passed with 88 documentation files, 12 extensions, 6
  presets, and 5 policies.
- `npm.cmd run package:check`: installed and exercised a 274-file tarball that
  includes trust, signature, and schema runtime.
- A generated Ed25519 key pair passed SPKI fingerprint import and canonical
  bundle signature verification; revoking the key immediately changed the same
  bundle to fail-closed `CATALOG_PUBLISHER_REVOKED`.

## Coverage

- Ed25519-only SPKI parsing and SHA-256 fingerprints;
- plan-first atomic trust changes;
- canonical bundle digest signatures and base64;
- unknown, invalid, trusted, and revoked key states;
- package schema and runtime inclusion;
- no resolver activation or code execution.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
