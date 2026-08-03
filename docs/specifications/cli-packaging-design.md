# CLI packaging design

## Decision

The CLI is distributed as the monolithic scoped package
`@basic-structure/cli`. The tarball embeds runtime libraries, schemas, core
documentation, templates, extensions, presets, and policies so lifecycle
commands behave identically outside the source repository.

An explicit package `files` allowlist excludes tests, work directories, Git
metadata, state, backups, coverage, dependencies, and real environment files.
Package verification audits `npm pack --dry-run`, installs the actual tarball in
an empty consumer, and runs version, catalog, initialization, and gate checks.

`version --json` exposes package version, Node requirement, supported schema
versions, and a deterministic SHA-256 digest over catalog paths and contents.

## Security boundaries

- Packaging and verification never publish to a registry.
- Consumer installation uses the local tarball with lifecycle scripts disabled.
- CI dependencies use an exact version, never `latest` or a floating range.
- The digest detects catalog differences but is not a signature.
- The package remains `UNLICENSED` until the owner selects a license.

## Acceptance criteria

1. The bin works from an installed tarball without source-repository paths.
2. Required runtime and catalog files are present.
3. Forbidden development, state, secret, and backup paths are absent.
4. Provenance is deterministic and machine-readable.
5. Packaged init and gate smoke pass.
6. Generated projects use an exact CLI dependency and gate script.

## Document status

- Status: Implemented
- Owner: Project maintainers
- Last reviewed: 2026-08-03

