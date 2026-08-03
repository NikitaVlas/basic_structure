# Extension compatibility matrix

## Supported versions

The starter version is `0.1.0`. Every built-in extension currently supports
`>=0.1.0 <1.0.0`.

| Extension | Version | Versioned requirements |
|---|---:|---|
| `profile:documentation-only` | `1.0.0` | None |
| `profile:fullstack-web` | `1.0.0` | `module:shared-contracts@^1.0.0` |
| `module:shared-contracts` | `1.0.0` | None |
| `module:observability` | `1.0.0` | None |
| `module:database-postgres` | `1.0.0` | None |
| `module:transactional-email` | `1.0.0` | `module:observability@^1.0.0`, `module:database-postgres@^1.0.0` |
| `module:rate-limit-valkey` | `1.0.0` | `module:observability@^1.0.0` |
| `module:auth-session` | `1.0.0` | shared contracts, database, observability, email, and rate limit at `^1.0.0` |
| `module:e2e-playwright` | `1.0.0` | full-stack profile, database, email, rate limit, and auth at `^1.0.0` |
| `adapter:github-ci` | `1.0.0` | None |
| `adapter:docker-production` | `1.0.0` | full-stack profile and its runtime modules at `^1.0.0` |
| `adapter:github-security` | `1.0.0` | GitHub CI and production Docker adapters at `^1.0.0` |

The manifests are the machine-readable source of truth. Update this table in
the same change whenever a built-in version, requirement, or starter range
changes.

## Version policy

- Patch: compatible fixes without a contract change.
- Minor: backward-compatible capabilities or optional fields.
- Major: incompatible contract, ownership, behavior, or migration requirements.
- Downgrades: blocked until a separate reverse-migration design exists.

Required migration notices may also make a minor or patch update blocking when
the operational risk warrants explicit acknowledgement.

## Supported range syntax

Examples:

```text
1.2.3
^1.2.3
~1.2.3
>=1.0.0 <2.0.0
```

Prereleases, wildcards, hyphen ranges, and `||` unions are deliberately not
supported. Invalid or unsupported syntax fails configuration validation.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related code: `scripts/lib/semver.mjs`, `scripts/lib/configuration.mjs`

