# Profiles, modules, and adapters

The executable starter is composed from three extension kinds.

## Profiles

A profile defines the application shape and owns the minimum runnable file
tree. Select exactly one profile in `project.config.json`.

Current profiles:

- `documentation-only` — process and quality documentation without a runtime;
- `fullstack-web` — TypeScript API, authenticated React/Vite application, and
  public Astro website.

## Modules

A module adds a bounded product or platform capability. Modules must own
distinct files and declare requirements and conflicts in `module.json`.

Current modules:

- `shared-contracts` — framework-independent API contracts;
- `observability` — dependency-free structured logging and secret redaction;
- `database-postgres` — PostgreSQL pooling, migrations, repositories, readiness,
  and local Docker services;
- `transactional-email` — typed account email templates, privacy-safe local
  capture, SMTP delivery, and a Mailpit development service;
- `auth-session` — secure cookie sessions, authentication API, and browser flow.

Modules can contribute only through named profile slots and declarative
`packageDependencies`. Generation rejects missing slots, missing targets, and
dependency version conflicts. Extension instructions are data; the initializer
does not execute extension scripts.

## Adapters

An adapter connects the generated project to an external platform without
making that platform part of the core architecture.

Current adapters:

- `github-ci` — GitHub Actions verification workflow.

## Manifest contract

Every extension has a versioned manifest validated against
`schemas/extension-manifest.schema.json`. Its `files` directory is copied into
the generated repository. Generation stops on unknown extensions, unmet
requirements, declared conflicts, or file collisions.

Use `{{PROJECT_NAME}}` and `{{PROJECT_DESCRIPTION}}` in text templates. The
initializer renders these values without executing template code.

## Adding an extension

1. Create `profiles/<id>`, `modules/<id>`, or `adapters/<id>`.
2. Add the matching manifest and a `template/` directory.
3. Keep file ownership disjoint from other selectable extensions.
4. Add the extension to an example configuration.
5. Add a bootstrap test that inspects its generated output.
6. Run `node scripts/verify.mjs --mode template`.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related code: `scripts/lib/configuration.mjs`, `scripts/lib/initializer.mjs`
