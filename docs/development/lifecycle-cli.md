# Lifecycle CLI

## Entry point

Run the CLI from the `basic_structure` repository:

```text
node bin/basic-structure.mjs --help
```

`npm run cli -- <command>` is equivalent. The CLI is not copied into generated
projects and is not yet published as an npm package.

## Commands

### Initialize

```text
node bin/basic-structure.mjs init --config project.config.fullstack.example.json --output ../example-saas --dry-run
node bin/basic-structure.mjs init --config project.config.fullstack.example.json --output ../example-saas
```

### Validate and inspect extensions

```text
node bin/basic-structure.mjs validate --config project.config.fullstack.example.json
node bin/basic-structure.mjs list
node bin/basic-structure.mjs list --kind module
```

### Update

```text
node bin/basic-structure.mjs update --project ../example-saas --plan
node bin/basic-structure.mjs update --project ../example-saas --apply
```

Migration acknowledgement remains explicit and repeatable:

```text
node bin/basic-structure.mjs update --project ../example-saas --plan --acknowledge-migration module:auth-session
```

### Change composition

```text
node bin/basic-structure.mjs add module auth-session --project ../example-saas --plan
node bin/basic-structure.mjs add module auth-session --project ../example-saas --apply
node bin/basic-structure.mjs remove module auth-session --project ../example-saas --plan
node bin/basic-structure.mjs remove module auth-session --project ../example-saas --apply
```

Only modules and adapters are supported. Add resolves missing requirements;
remove rejects selected dependents. See
[`composition changes`](composition-changes.md) for backup, conflict, and
post-apply verification requirements.

### Switch profile

Always inspect the migration plan before apply:

```text
node bin/basic-structure.mjs switch-profile fullstack-web --project ../example-saas --plan
node bin/basic-structure.mjs switch-profile fullstack-web --project ../example-saas --apply
```

The target profile replaces `surfaces` and adds its missing requirements. If
selected extensions are incompatible, the command stops and lists them. Review
the list before explicitly acknowledging their removal:

```text
node bin/basic-structure.mjs switch-profile documentation-only --project ../example-saas --plan --prune-incompatible
```

See [`profile migration`](profile-migration.md) for safety and recovery rules.

### Author extensions

```text
node bin/basic-structure.mjs create-extension module payments
node bin/basic-structure.mjs validate-extension module payments
node bin/basic-structure.mjs test-extension module payments
```

The same commands support `profile` and `adapter`. Creation refuses existing
destinations; validation and testing use the production resolver and generator.
See [`extension authoring`](extension-authoring.md) for the scaffold contract and
runtime-testing responsibilities.

### Use presets

```text
node bin/basic-structure.mjs list-presets
node bin/basic-structure.mjs init --preset saas --name example-saas --output ../example-saas
node bin/basic-structure.mjs diff-preset production --project ../example-saas
node bin/basic-structure.mjs apply-preset production --project ../example-saas --apply
```

Application is additive unless exact removal is explicitly acknowledged with
`--prune`. See [`project presets`](presets.md).

### Discover capabilities

```text
node bin/basic-structure.mjs search authentication
node bin/basic-structure.mjs inspect module auth-session
node bin/basic-structure.mjs inspect-preset saas
node bin/basic-structure.mjs recommend --capability authentication --profile fullstack-web
```

Discovery is local and read-only. See the
[`capability catalog`](capability-catalog.md).

### Enforce harness policies

```text
node bin/basic-structure.mjs policy list
node bin/basic-structure.mjs policy check --project ../example-saas
node bin/basic-structure.mjs policy apply production-readiness --project ../example-saas --plan
```

Policy violations use exit code `4`. See
[`harness policies`](harness-policies.md).

### Run the CI gate

```text
node bin/basic-structure.mjs drift check --project ../example-saas
node bin/basic-structure.mjs gate check --project ../example-saas --json
```

Gate failures use exit code `5`. See [`CI gates`](ci-gates.md).

### Diagnose

```text
node bin/basic-structure.mjs doctor --project ../example-saas
```

Doctor is read-only. It validates the Node runtime, configuration,
compatibility, generated state and upgrade plan, Git, conditional Docker
requirements, verification entry point, and incomplete upgrade reports.

## JSON output

Add `--json` anywhere in a command. Exactly one JSON object is written to
stdout, including for invalid, blocked, and unhealthy results:

```text
node bin/basic-structure.mjs doctor --project ../example-saas --json
```

Consumers must check both `ok` and `exitCode`. Current exit codes are `0` for
success, `1` for invalid input or command failure, `2` for a blocked update, and
`3` for an unhealthy doctor result.

## Legacy scripts

`scripts/init-project.mjs`, `scripts/validate-config.mjs`, and
`scripts/update-project.mjs` remain available as compatibility entry points.
New automation should use the unified CLI and its versioned JSON envelope.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related code: `bin/basic-structure.mjs`, `scripts/lib/cli.mjs`, `scripts/lib/doctor.mjs`
