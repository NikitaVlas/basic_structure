# Preset engine design

## Decision

Versioned JSON presets under `presets/` describe a profile plus constrained
module and adapter selections. `extends` composes recipes recursively. Loading
fails on inheritance cycles, conflicting profiles, malformed identifiers,
invalid semantic ranges, unknown extensions, or incompatible resolved versions.

Commands:

```text
basic-structure list-presets
basic-structure init --preset <id> --name <project> --output <directory>
basic-structure diff-preset <id> --project <directory>
basic-structure apply-preset <id> --project <directory> [--plan|--apply]
```

Application is additive by default: required selections are added while
compatible existing modules and adapters remain. `--prune` requests exact
convergence and explicitly permits removal of selections outside the resolved
preset. Neither mode overrides file conflicts, extension migrations, stale
state, unfinished reports, or transactional rollback rules.

Presets are declarative. They never execute code, package managers, network
requests, Git, Docker, deployments, or data migrations.

## Acceptance criteria

1. Catalog resolution is deterministic and cycle-safe.
2. Profile and extension SemVer constraints fail closed.
3. Required extensions are included recursively.
4. Preset initialization produces a valid generated project.
5. Diff is read-only and exposes exact composition evidence.
6. Additive application preserves compatible selections.
7. Exact pruning requires `--prune` and uses three-way file safety.
8. Apply updates configuration, files, state, backup, and report atomically.

## Document status

- Status: Implemented
- Owner: Project maintainers
- Last reviewed: 2026-08-03

