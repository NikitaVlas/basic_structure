# Adopting an existing project

Adoption adds the Basic Structure governance and lifecycle layer without
reinitializing the application or taking ownership of its existing source.

Always inspect the plan first:

```text
basic-structure adopt --project ./existing-project --plan --json
```

Review detected frameworks and capabilities, the recommended profile, paths
classified as user-owned, missing core files proposed as managed, and reserved
control-path conflicts. Override the recommendation when the repository shape
does not express its intended product boundary:

```text
basic-structure adopt --project ./existing-project --profile backend-service --plan
basic-structure adopt --project ./existing-project --profile backend-service --apply
```

## Ownership

State schema v5 records two disjoint sets:

- `adoption.userOwnedFiles` contains the SHA-256 baseline of every pre-existing
  regular file. These files remain outside drift and upgrade ownership.
- `generatedFiles` contains only missing core governance files created by the
  adoption transaction.

When an existing path overlaps a core template path, adoption preserves it and
records it in `excludedManagedPaths`. Reserved `project.config.json` and
`.basic-structure` control paths block adoption rather than being overwritten.

Application rechecks every destination with exclusive creation. If a path
appears after planning, files created by that adoption attempt are rolled back
and the new user file is preserved.

## After adoption

```text
basic-structure doctor --project ./existing-project
basic-structure policy check --project ./existing-project
basic-structure drift check --project ./existing-project
basic-structure gate check --project ./existing-project
basic-structure gate evidence --project ./existing-project --json
```

The report at `.basic-structure/adoption-report.json` records the detected
project shape and ownership split. Subsequent updates manage the governance
layer while leaving application source under user ownership.
