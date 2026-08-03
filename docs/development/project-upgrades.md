# Project upgrades

## Purpose

The upgrade engine transfers newer starter-owned files into an existing
generated project without treating user code as disposable output. Run it from
the `basic_structure` repository and point it at a project that contains
`project.config.json` and `.basic-structure/state.json`.

## Plan first

```text
node scripts/update-project.mjs --project ../example-saas --plan
```

Planning renders the current project configuration in an isolated temporary
directory and performs no writes to the target. Review every non-`unchanged`
entry. `user-modified` files are preserved automatically. `conflict` and
`legacy-conflict` entries block the complete apply operation.

Text hashes normalize LF and CRLF so ordinary cross-platform Git checkouts do
not look like user modifications. Binary files are hashed byte-for-byte.

State schema version 1 did not record content hashes. A legacy file can be
adopted automatically only when it already equals current starter output. Any
difference requires manual review; the engine will not guess whether it came
from the user or an older starter version.

## Apply

```text
node scripts/update-project.mjs --project ../example-saas --apply
```

Apply refuses all writes if a conflict exists. Changed and retired files are
copied below `.basic-structure/backups/<operation-id>/` before mutation. The
operation report is stored below `.basic-structure/reports/`, and state is
advanced only after file operations succeed. A failed operation restores
backed-up files and the previous state.

After apply, inspect the diff and run the generated project's verification
commands. Dependency installation and lockfile refresh are explicit operator
steps because they may execute third-party lifecycle scripts or access the
network.

## Conflict resolution

For a `conflict`, compare the user file with current starter output, integrate
the required changes manually, and rerun `--plan`. When the resulting content
matches the desired starter file it becomes `unchanged`. If the starter did not
change that path, the engine reports `user-modified` and preserves it.

For a `legacy-conflict`, first establish the historical starter baseline or
review and align the file manually. Do not add fabricated hashes to state.

## Security boundaries

- Managed paths must be normalized, relative paths.
- Managed files and all existing parent path components must not be symlinks.
- Invalid or duplicate state entries fail closed.
- The updater never installs dependencies, runs extension code, commits, pushes,
  deploys, or executes database migrations.
- Backup restoration is deliberate and manual after inspecting the operation
  report.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related code: `scripts/update-project.mjs`, `scripts/lib/upgrade.mjs`
