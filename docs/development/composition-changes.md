# Composition changes

## Preconditions

Run composition commands from the `basic_structure` repository against a
generated project. The project must already match the current starter:

```text
node bin/basic-structure.mjs update --project ../example-saas --plan
```

If ordinary updates, version migrations, missing files, or conflicts are
pending, resolve and apply them before changing the selected extensions.
User-only modifications may remain; the composition plan preserves them unless
the requested extension change also needs that path.
Any upgrade report left outside the `applied` state must be reviewed first;
overlapping composition transactions fail with `UNFINISHED_UPGRADE`.

## Add an extension

Always review a plan first:

```text
node bin/basic-structure.mjs add module auth-session --project ../example-saas --plan
node bin/basic-structure.mjs add module auth-session --project ../example-saas --apply
```

Missing local module and adapter requirements are added recursively and shown as
`REQUIRED`. Profile requirements are never changed automatically. The final set
must pass manifest version, starter, conflict, and cycle validation.

Adding an extension may create its files and recompose contribution targets and
package manifests. The command does not run package installation; inspect the
diff, refresh the lockfile deliberately, and run project verification afterward.

## Remove an extension

```text
node bin/basic-structure.mjs remove module auth-session --project ../example-saas --plan
node bin/basic-structure.mjs remove module auth-session --project ../example-saas --apply
```

Removal fails when another selected extension requires the target. Remove the
dependent explicitly first; the CLI never performs a cascading removal.
Unmodified owned files become `safe-delete`. A user-modified retired file is a
conflict and blocks the entire operation. Shared contribution targets and
package manifests are regenerated from the remaining composition.

## Apply and recovery

Apply backs up `project.config.json` and all replaced or retired managed files
under `.basic-structure/backups/<operation-id>/`. Files, configuration, and
state are treated as one operation and restored on failure. The JSON operation
report includes `compositionChange`, `configChange`, extension changes, and file
evidence.

After apply:

1. inspect the source and configuration diff;
2. review the operation report and backup path;
3. install or prune dependencies explicitly when required;
4. regenerate the lockfile through the project's approved package workflow;
5. run `doctor` and the generated project's `verify` command.

## Unsupported changes

- Profile replacement is not supported.
- Automatic cascading removal is not supported.
- Remote extension discovery and installation are not supported.
- Migration instructions are not executed automatically.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related code: `scripts/lib/composition.mjs`, `scripts/lib/upgrade.mjs`, `scripts/lib/cli.mjs`
