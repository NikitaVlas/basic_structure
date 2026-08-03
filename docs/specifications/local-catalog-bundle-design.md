# Verified local catalog bundle design

## Decision

A bundle is a regular local directory containing `catalog.json` plus extension,
preset, or policy files. Metadata declares publisher, catalog id, semantic
version, compatible CLI range, and the exact SHA-256 digest of every file.

The verifier rejects unsafe paths, symlinks, undeclared files, missing files,
checksum changes, excessive size/count, invalid extension manifests, duplicate
identities, and collisions with the built-in catalog. A deterministic bundle
digest commits to sorted paths and declared hashes.

Plan-first installation copies a verified immutable version beneath
`.basic-structure/catalogs/<publisher>/<id>/<version>/`. Installed bundles are
isolated cache artifacts and do not automatically enter extension resolution.
Activation requires the later trust-store and signed-provenance stage.

Network URLs, archives, scripts, signature claims, identity overrides, and
remote synchronization are excluded.

## Document status

- Status: Implemented
- Owner: Project maintainers
- Last reviewed: 2026-08-03

