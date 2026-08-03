# Project upgrade engine quality plan

## Scope

Safe planning and application of starter-owned file updates in an existing
generated project.

## Threat model

The target repository, its state file, and filesystem entries are untrusted.
The engine validates managed paths, rejects symlinks and malformed state, never
executes generated content, and blocks all writes when the plan contains a
conflict.

## Coverage matrix

| Acceptance area | Evidence |
|---|---|
| State v3 hashes and versions | Initializer and upgrade unit tests |
| Read-only plan | Filesystem snapshot assertion |
| Safe update and new file | Upgrade integration test |
| User modification preservation | Upgrade conflict tests |
| Retired files | Safe-delete and modified-retired tests |
| Backup and report | Upgrade apply integration test |
| Legacy state | Schema v1 fail-closed test |
| Path and symlink safety | Negative validation tests |

## Verification summary

- Current combined suite: 35 passed, 1 skipped because this Windows host does not permit
  symlink creation; traversal and invalid-path rejection still passed.
- `npm run verify`: passed with 58 documents and 12 extensions.
- Clean full-stack generation: 175 files written, including 173 hashed managed
  files; state schema version 3 now also records extension versions.
- Clean-project upgrade plan: 173 `unchanged`, no writes and no conflicts.
- `git diff --check`: passed; Git reported only expected checkout line-ending
  notices.

## Known limitations

- No automatic text merge or executable migration hooks.
- Dependency installation remains an explicit post-update operation.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/project-upgrade-engine-design.md`
