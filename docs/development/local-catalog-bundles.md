# Verified local catalog bundles

```text
basic-structure catalog inspect ./vendor/catalog
basic-structure catalog verify ./vendor/catalog
basic-structure catalog add ./vendor/catalog --project . --plan
basic-structure catalog add ./vendor/catalog --project . --apply
basic-structure catalog list --project .
basic-structure catalog remove publisher/catalog@1.0.0 --project . --plan
```

`catalog.json` declares `schemaVersion`, `publisher`, `id`, `version`, a CLI
semantic range, and a `files` object mapping safe relative paths to lowercase
SHA-256 digests. Every regular file except `catalog.json` must appear exactly
once. Symbolic links and identity overrides are forbidden.

Installation is an immutable verified cache only. Bundles are not activated in
search, recommendation, generation, or policy resolution until signed publisher
trust is implemented. Never treat checksums alone as publisher authentication.

Only local directories are accepted. No command downloads URLs, extracts
archives, installs dependencies, or executes bundle code.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03

