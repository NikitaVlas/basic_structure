# Profile migration

Use the dedicated command because a profile owns root runtime files and project
surfaces:

```text
node bin/basic-structure.mjs switch-profile fullstack-web --project ../example-saas --plan
node bin/basic-structure.mjs switch-profile fullstack-web --project ../example-saas --apply
```

The target profile's `surfaces` replace the previous list and its required
modules or adapters are added automatically. Plans are read-only and show all
configuration, extension, and file changes.

## Incompatible extensions

Profile requirements, conflicts, transitive dependents, and contribution slots
are checked against the target. The command fails with
`PROFILE_PRUNE_REQUIRED` when selected extensions cannot survive the switch.
Nothing is removed implicitly. Review the reported identities, then opt in:

```text
node bin/basic-structure.mjs switch-profile documentation-only --project ../example-saas --plan --prune-incompatible
node bin/basic-structure.mjs switch-profile documentation-only --project ../example-saas --apply --prune-incompatible
```

`--prune-incompatible` does not override modified-file conflicts, occupied
paths, version migration acknowledgements, stale state, or unfinished reports.

## Recovery and follow-up

Apply backs up configuration and affected managed files under
`.basic-structure/backups/<operation-id>/` and writes an operation report. A
failure restores configuration, files, and state together. After a successful
migration, inspect the report, refresh dependencies and lockfiles deliberately,
run project verification, and finish with `doctor`.

The engine does not migrate application data or translate user-owned runtime
code between profiles.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/profile-migration-design.md`
