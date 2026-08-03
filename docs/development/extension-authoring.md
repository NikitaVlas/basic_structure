# Extension authoring

## Create a scaffold

Run the command from the starter repository:

```text
node bin/basic-structure.mjs create-extension module payments --description "Local payment boundary."
node bin/basic-structure.mjs create-extension adapter cloudflare
node bin/basic-structure.mjs create-extension profile backend-service
```

The command creates the extension manifest, `template/.gitkeep`, an author
README, and `test/fixture.config.json`. It refuses to overwrite an existing
identity. Replace the empty template with owned generated files and declare
requirements, conflicts, contributions, package dependencies, surfaces for a
profile, and migrations in the manifest when applicable.

The fixture is part of the extension contract. It must select the extension and
all of its requirements using a representative compatible profile.

## Validate

```text
node bin/basic-structure.mjs validate-extension module payments
```

Validation uses the same manifest loader and configuration resolver as project
generation. It checks identity, schema-level invariants, local files,
contribution fragments, fixture selection, requirements, versions, conflicts,
cycles, and starter compatibility.

## Run the integration contract

```text
node bin/basic-structure.mjs test-extension module payments
```

The command generates the fixture in an isolated temporary directory and
requires a clean update plan. Modules and adapters are then removed and added
again through the transactional composition engine. A successful result proves
the round-trip returned to a clean generated state. Profile fixtures use
initialization and clean upgrade verification; profile switching has its own
migration test suite.

These checks do not install dependencies or execute runtime code. Extension
authors remain responsible for package installation, type checking, unit and
integration tests, data migrations, and runtime-specific security validation.

Use `--json` for automation. A non-zero exit means the extension is not ready
to participate in generation.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/extension-authoring-kit-design.md`

