# Release readiness

Run the complete local release gate with `npm run release:check`. It executes
the full test suite, template verification, deterministic performance budgets,
and an installed-tarball consumer smoke test.

CI repeats the gate on current Node 22 for Windows and Linux. The package remains
`UNLICENSED`; local and internal use can be verified, but public publication is
not approved until the owner selects a license.

## First-release checklist

- Release gate passes from a clean checkout.
- Windows and Linux matrix jobs pass.
- Package allowlist contains runtime files and excludes tests, secrets, caches,
  generated projects, and repository internals.
- CLI package provenance and catalog digest are present.
- Known limitations and trust boundaries are documented.
- Version and changelog are reviewed.
- License is selected before any public publication.
