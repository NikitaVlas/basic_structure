# CLI installation and distribution

Verify the exact artifact without publishing:

```text
npm run package:check
npm pack
npm install --save-dev ../basic-structure-cli-0.1.0.tgz
npx basic-structure version --json
```

After licensing and a reviewed registry release, pin the exact version:

```text
npm install --save-dev @basic-structure/cli@0.1.0
npx basic-structure gate check --project . --json
```

Do not use `latest`, caret ranges, or runtime network installation in production
CI. Commit the reviewed lockfile. Monorepos may use an exact workspace
dependency during development.

`basic-structure version --json` returns the package version and catalog SHA-256
digest. Record both in release evidence. The digest detects content changes but
is not a publisher signature.

The package is currently `UNLICENSED`; registry publication should wait until
the owner chooses and records the intended license.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/cli-packaging-design.md`

