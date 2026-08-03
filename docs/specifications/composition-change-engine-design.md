# Composition change engine design

## Problem

Generated projects can update existing extensions but cannot safely add or
remove modules and adapters. Composition changes affect owned files,
contribution slots, package dependencies, configuration, state, and transitive
requirements as one operation.

## Decision

The lifecycle CLI adds plan-first `add` and `remove` commands for modules and
adapters. Profile replacement is excluded because it changes the application's
root ownership model and requires a separate migration design.

Before planning a composition change, the engine requires the existing project
to be synchronized with the current starter. Existing `safe-update`, `new`,
`safe-delete`, version migration, downgrade, or conflict conditions block the
composition operation. User-only modifications are allowed and remain subject
to the normal three-way comparison.
Any upgrade report not marked `applied` also blocks the operation so a new
transaction cannot overlap an unfinished one.

### Add

The engine recursively includes missing module or adapter requirements from
local manifests. A profile requirement must already match the selected profile.
The final composition is resolved through normal version, conflict, cycle, and
starter compatibility checks.

### Remove

Removal is rejected when another selected extension directly requires the
target. The message identifies each dependent extension. The engine never
cascades removals implicitly.

### Apply

The proposed configuration is rendered through the initializer and compared as
baseline/current/desired. Apply uses the existing all-or-nothing conflict gate,
backs up replaced and retired files plus `project.config.json`, writes files,
configuration, and state, and restores all three on failure. The operation
report includes the requested change, automatically added dependencies, config
delta, extension delta, and file evidence.

## Security boundaries

- Only reviewed local manifests participate; no registry or network resolution.
- Kind and id arguments use the existing strict identifier grammar.
- Add/remove never executes extension code, package managers, migration text,
  Git, Docker, deployment, or database commands.
- An occupied new path, modified retired file, changed generated target, or
  stale project blocks the complete apply operation.
- Configuration is written only after backup and restored on any apply failure.
- Plan mode does not modify the target project.

## Acceptance criteria

1. Add recursively plans required local extensions and reports which were
   automatic.
2. Add rejects incompatible profile requirements, conflicts, and missing or
   incompatible dependencies.
3. Remove rejects selected dependents and never cascades implicitly.
4. File, contribution, and package dependency changes use three-way safety.
5. Plan is read-only; apply updates config, files, and state together.
6. Apply backs up configuration and affected files and rolls all changes back
   after an injected failure.
7. User-modified retired files and occupied new paths block apply.
8. Human and JSON CLI output expose request, dependency, config, extension, and
   file evidence.

## Non-goals

- Profile replacement, which is specified separately in
  `docs/specifications/profile-migration-design.md`.
- Automatic cascading removal.
- Installing package dependencies or regenerating lockfiles.
- Remote extension discovery.

## Document status

- Status: Approved
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related code: `scripts/lib/composition.mjs`, `scripts/lib/upgrade.mjs`, `scripts/lib/cli.mjs`
