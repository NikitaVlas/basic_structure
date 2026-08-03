# Unified lifecycle CLI design

## Problem

Initialization, configuration validation, verification, and upgrades currently
use separate scripts with different argument and output conventions. Humans and
automation need one stable entry point without duplicating lifecycle logic.

## Decision

`bin/basic-structure.mjs` is the public local CLI entry point. It delegates to
testable library functions and exposes these commands:

- `init`: plan or create a project from configuration;
- `validate`: resolve configuration and extension compatibility;
- `list`: enumerate locally available versioned extensions;
- `update`: plan or apply the existing safe upgrade engine;
- `add`: add a module or adapter with recursive local requirements;
- `remove`: remove an extension only when no selected dependent requires it;
- `switch-profile`: migrate root ownership with explicit incompatible-extension
  pruning acknowledgement;
- `create-extension`: atomically scaffold a local extension contract;
- `validate-extension`: validate a manifest and selected integration fixture;
- `test-extension`: run isolated generation and supported round-trip checks;
- `list-presets`: resolve and list composable local recipes;
- `diff-preset`: expose a read-only preset composition plan;
- `apply-preset`: transactionally add or exactly converge a preset;
- `search`: query local extension and preset metadata;
- `inspect` and `inspect-preset`: expose exact catalog evidence;
- `recommend`: derive a read-only capability composition and preset matches;
- `doctor`: perform read-only environment and project diagnostics.

The legacy scripts remain compatible wrappers during this stage.

## Output contract

Human output is concise and command-oriented. `--json` emits exactly one JSON
object to stdout and no decorative text:

```json
{
  "schemaVersion": 1,
  "command": "validate",
  "ok": true,
  "exitCode": 0,
  "data": {}
}
```

Errors use the same envelope with an `error` object containing `code` and
`message`. Stack traces and secrets are never emitted by default.

Exit codes:

- `0`: command succeeded;
- `1`: invalid arguments, invalid input, or unexpected operational failure;
- `2`: update blocked by migration or file conflicts;
- `3`: doctor completed and found a required failing check.

## Doctor contract

Doctor does not mutate the target. It checks Node compatibility, configuration
and extension resolution, state/upgrade integrity, Git availability, Docker
availability when the production Docker adapter is selected, the generated
project's verification entry point when a package manifest exists, and
unfinished upgrade reports. Optional checks may warn or be not applicable;
required failures make the result unhealthy.

## Security boundaries

- CLI paths are resolved but never widened into recursive filesystem access
  outside the command's explicit target.
- Doctor executes only fixed `git --version` and `docker --version` probes with
  no shell interpolation.
- `--json` treats repository and tool messages as data, not executable output.
- Update acknowledgements retain the exact existing qualified-id validation.
- CLI does not install dependencies, access registries, commit, push, deploy,
  or execute migration instructions.

## Acceptance criteria

1. Every command supports command-scoped help.
2. Unknown commands and options fail consistently.
3. JSON success, error, blocked, and unhealthy results follow one schema.
4. `init`, `validate`, and `update` preserve existing behavior; `add`,
   `remove`, and `switch-profile` delegate to transactional composition plans.
5. `list` reports exact local extension versions and requirements.
6. Doctor is read-only and distinguishes required, optional, and skipped checks.
7. CLI functions are covered without spawning a shell.
8. Documentation and package metadata expose the unified entry point.

## Document status

- Status: Completed
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related code: `bin/basic-structure.mjs`, `scripts/lib/cli.mjs`, `scripts/lib/doctor.mjs`
