# Extension versioning quality plan

## Scope

Manifest SemVer validation, compatibility resolution, persisted extension
versions, and upgrade migration acknowledgement.

## Threat model

Manifest metadata is repository-controlled but malformed input must fail closed.
Migration descriptions are inert text. No manifest field may cause executable
code, dependency installation, network access, or an implicit compatibility
bypass.

## Coverage matrix

| Acceptance area | Evidence |
|---|---|
| SemVer and range behavior | Unit tests for exact, caret, tilde, comparator, and invalid ranges |
| Starter compatibility | Configuration resolution tests |
| Versioned requirements | Compatible and incompatible composition tests |
| State v3 versions | Initializer tests |
| Upgrade classification | Upgrade integration tests |
| Migration acknowledgement | Blocked/unblocked upgrade tests |
| Downgrade prevention | Negative upgrade test |
| Built-in manifests | Template verification and full-stack bootstrap |

## Verification summary

- Current combined suite: 35 passed; one symlink-creation test skipped because the Windows
  host does not permit symlink creation.
- SemVer coverage includes exact, caret, tilde, comparator, invalid syntax,
  missing requirements, incompatible selected versions, unsupported starter
  versions, requirement cycles, compatible upgrades, breaking upgrades,
  acknowledgement, downgrade rejection, and state v2 baseline adoption.
- `npm run verify`: passed with 58 documents and 12 schema-v2 extensions.
- Full-stack configuration resolved starter `0.1.0` and 11 selected extensions
  at `1.0.0`.
- Clean full-stack generation produced state schema version 3 with 173 hashed
  managed files; a subsequent plan reported all 173 as `unchanged`.

## Known limitations

- The supported SemVer range grammar is deliberately smaller than npm's.
- Migration instructions are operator-executed and not automatically verified.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/extension-versioning-design.md`
