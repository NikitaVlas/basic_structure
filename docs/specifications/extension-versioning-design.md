# Extension versioning and compatibility design

## Problem

Profiles, modules, and adapters declare identity relationships but not release
versions. The generator can detect a missing dependency, yet it cannot reject an
incompatible dependency version or distinguish a routine upgrade from a
breaking migration.

## Decision

Extension manifest schema version 2 requires:

- a strict `MAJOR.MINOR.PATCH` version;
- a supported starter SemVer range;
- versioned `requires` entries keyed by `profile:`, `module:`, or `adapter:` id;
- optional declarative migration notices.

The supported range language is intentionally small and deterministic: exact
versions, `^`, `~`, and whitespace-separated `>`, `>=`, `<`, or `<=`
comparators. Prerelease versions, wildcards, unions, and remote resolution are
not supported.

Generated state schema version 3 stores the exact selected extension versions.
Upgrade planning compares the previous and desired versions before file apply:

| Status | Meaning | Policy |
|---|---|---|
| `unchanged` | Same version | Continue |
| `compatible` | Forward minor or patch update without required migration | Continue |
| `baseline-adoption` | Older state lacks extension versions | Continue; file hashes remain authoritative |
| `migration-required` | Matching migration notice or major-version update | Require explicit acknowledgement |
| `downgrade-blocked` | Desired version is older | Block |
| `removed` / `added` | Composition changed | Report; file conflict policy remains authoritative |

Acknowledgement is scoped to an exact extension id and a single plan invocation.
It does not execute migration code. Migration notices contain operator-readable
instructions and are persisted into the upgrade report.

## Security and integrity

- Compatibility is resolved only from local reviewed manifests.
- Invalid versions, ranges, dependency identities, and migration declarations
  fail before generation.
- A requirement must name a selected extension and its installed version must
  satisfy the declared range.
- Every selected extension must support the current starter version.
- Downgrades fail closed because reverse migrations are not defined.
- Acknowledgement permits reviewed file application but never runs shell,
  database, network, package-manager, or extension-provided code.

## Acceptance criteria

1. All built-in manifests use schema version 2 and valid SemVer metadata.
2. Invalid and incompatible compositions fail with an actionable error.
3. State schema version 3 records exact versions by qualified extension id.
4. Upgrade plans report old/new versions and migration notices.
5. Major and explicitly breaking upgrades block without acknowledgement.
6. Exact acknowledgement unblocks the version gate without bypassing file
   conflicts.
7. Downgrades remain blocked.
8. Documentation publishes the built-in compatibility matrix.

## Non-goals

- Downloading or resolving extensions from a registry.
- npm-compatible range syntax in full.
- Automatic migration execution or rollback.
- Inferring compatibility from source code.

## Document status

- Status: Completed
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related code: `scripts/lib/semver.mjs`, `scripts/lib/configuration.mjs`, `scripts/lib/upgrade.mjs`
