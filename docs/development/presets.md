# Project presets

List the resolved local recipes:

```text
node bin/basic-structure.mjs list-presets
```

The built-in progression is `fullstack-minimal`, `saas`, `production`,
`security-hardened`, and `fullstack-complete`. `documentation` is the separate
runtime-free recipe.

## Initialize

```text
node bin/basic-structure.mjs init --preset saas --name example-saas --description "Customer workspace" --output ../example-saas
```

## Apply to an existing project

Always inspect the read-only diff first:

```text
node bin/basic-structure.mjs diff-preset production --project ../example-saas
node bin/basic-structure.mjs apply-preset production --project ../example-saas --plan
node bin/basic-structure.mjs apply-preset production --project ../example-saas --apply
```

Default application is additive. Compatible selections already in the project
remain even when the preset does not mention them. To converge to the exact
resolved recipe, review the removal list and opt in explicitly:

```text
node bin/basic-structure.mjs diff-preset fullstack-minimal --project ../example-saas --prune
node bin/basic-structure.mjs apply-preset fullstack-minimal --project ../example-saas --apply --prune
```

`--prune` does not suppress modified-file conflicts, occupied paths, migration
acknowledgements, stale projects, or unfinished operations. Apply uses the same
configuration/file/state transaction, backup, report, and rollback guarantees
as other composition changes. Dependency installation and data migrations are
explicit operator steps after apply.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/preset-engine-design.md`

