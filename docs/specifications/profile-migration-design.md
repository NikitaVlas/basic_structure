# Profile migration design

## Problem

A profile owns the generated project's root runtime shape. Replacing it may
retire application surfaces, introduce new root files, invalidate selected
extensions, and change contribution targets. Treating that operation as a
normal extension add or remove would hide destructive consequences.

## Decision

The lifecycle CLI provides a dedicated plan-first command:

```text
basic-structure switch-profile <id> [--plan|--apply] [--prune-incompatible]
```

The project must be synchronized with the current starter and have no
unfinished upgrade reports. Switching to the already selected profile is an
error.

The engine first selects the target profile and recursively adds its missing
local module and adapter requirements. It then validates every previously
selected module and adapter against the proposed composition.

Extensions made invalid by the new profile, together with extensions that
depend on them, are reported as an explicit prune set. The default operation is
blocked. `--prune-incompatible` acknowledges that exact class of destructive
change and allows the engine to remove the reported set before final resolution.
The flag never suppresses file conflicts or migration acknowledgements.

## Transaction boundary

Profile, module, and adapter configuration changes, generated files, state,
backup, and operation report form one transaction. The existing upgrade engine
performs three-way classification and rollback. Modified retired files,
occupied new paths, extension migration gates, and destination symlinks still
block apply.

## Evidence

Human and JSON plans expose:

- source and target profile identities;
- automatically added requirements;
- incompatible extensions and the acknowledged prune set;
- configuration, extension, and file changes;
- backup and operation identifiers after apply.

## Non-goals

- Inferring business-data or database migrations.
- Executing package managers, extension code, Git, Docker, or deployment tools.
- Silently deleting incompatible extensions.
- Mapping arbitrary user-owned runtime code between profiles.

## Acceptance criteria

1. Plan mode is read-only and rejects an unchanged target profile.
2. Target profile requirements are added recursively.
3. Incompatible extensions block by default and are listed deterministically.
4. Explicit pruning removes direct and transitive incompatible dependents.
5. Three-way file safety protects modified retired and occupied new paths.
6. Apply updates configuration, files, state, backup, and report atomically.
7. Injected failure restores the previous profile configuration and files.
8. Human and JSON CLI behavior is covered by automated tests.

## Document status

- Status: Approved
- Owner: Project maintainers
- Last reviewed: 2026-08-03

