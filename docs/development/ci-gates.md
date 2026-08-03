# CI drift and policy gates

Run locally before review:

```text
node bin/basic-structure.mjs drift check --project ../example-saas
node bin/basic-structure.mjs gate check --project ../example-saas
node bin/basic-structure.mjs gate explain --project ../example-saas --json
```

The unified report contains `drift`, `configuration`, `state`, `policies`,
`environment`, `unfinished-operations`, and `verification-entrypoint`. Exit
code `5` means the CI gate failed. The command is read-only and does not execute
the project's `verify` script; CI should run that script as a separate step.

The starter repository includes
`.github/workflows/basic-structure-gate.yml`, which runs gate regression tests
and validates the complete local catalog. Generated repositories can invoke the
same `gate check` command once the CLI is installed or vendored at a reviewed,
pinned path. Automatic network installation is intentionally excluded until
CLI packaging and provenance are implemented.

Resolve drift through the normal `update --plan` workflow. Resolve policy gaps
through reviewed documentation or `policy apply --plan`. Never rewrite state or
operation reports manually merely to make the gate pass.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/ci-gate-design.md`

