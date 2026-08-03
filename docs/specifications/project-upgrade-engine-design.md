# Project upgrade engine design

## Problem

The initializer creates a repository once and deliberately refuses to overwrite
an existing project. Generated projects therefore cannot safely receive newer
core, profile, module, or adapter files from the starter.

## Decision

Generated state schema version 3 records a SHA-256 baseline for every owned
file plus exact extension versions after rendering, contributions, and package dependency composition. The
upgrade engine renders the selected configuration into an isolated temporary
directory and compares three values:

- baseline: the hash recorded by the previous successful generation or update;
- current: the content in the user's project;
- desired: the content produced by the current starter.

The planner classifies every path before the apply phase:

| Status | Meaning | Apply behavior |
|---|---|---|
| `unchanged` | Current and desired content match | No write |
| `safe-update` | Current matches baseline; desired changed | Replace after backup |
| `safe-delete` | Current matches baseline; starter retired the file | Delete after backup |
| `new` | Starter introduced an unoccupied path | Create |
| `user-modified` | User changed a file that the starter did not change | Preserve |
| `conflict` | User and starter changed the same path, or a new path is occupied | Block apply |
| `legacy-conflict` | Schema v1 has no baseline and current differs from desired | Block apply |

`--plan` is read-only. `--apply` refuses the complete operation when any
blocking conflict exists; it does not partially update the project. Before the
first replacement or deletion, apply copies affected files into a timestamped
`.basic-structure/backups/` directory. A JSON report records the plan and the
result. Backup restoration remains an explicit operator action.

## Trust boundaries and abuse cases

- Project and state paths are untrusted input. Every managed path must be a
  normalized relative path contained by the project root.
- Symlinks at managed destinations are rejected so an update cannot write
  outside the project through link traversal.
- State hashes are evidence, not authorization. Invalid algorithms, duplicate
  paths, malformed owners, and unsupported state versions fail closed.
- Extension output is composed with the same collision and configuration
  checks as initialization.
- Migration code is not executed implicitly. Breaking migrations must be
  delivered as explicit, reviewed operator instructions until a separately
  sandboxed migration contract exists.

## Acceptance criteria

1. New projects contain state schema version 3, extension versions, and SHA-256 hashes.
2. Planning never modifies the target project.
3. Unmodified owned files update automatically.
4. User-only edits are preserved.
5. Concurrent edits and occupied new paths block the entire apply operation.
6. Retired unmodified files are backed up and removed; modified retired files
   block apply.
7. Apply produces a backup and machine-readable report before committing new
   state.
8. Schema v1 projects are handled conservatively without guessed ownership.
9. Tests cover traversal, conflicts, updates, deletion, backup, and dry runs.

## Non-goals

- Automatic three-way text merges.
- Dependency installation or lockfile regeneration.
- Executing arbitrary extension migration scripts.
- Git commits, pushes, or deployment.

## Document status

- Status: Completed
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related code: `scripts/lib/upgrade.mjs`, `scripts/update-project.mjs`
