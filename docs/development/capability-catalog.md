# Capability catalog

## Discover

```text
node bin/basic-structure.mjs search authentication
node bin/basic-structure.mjs search production --kind preset
node bin/basic-structure.mjs inspect module auth-session
node bin/basic-structure.mjs inspect-preset saas
```

Search uses local identities, names, descriptions, capabilities, and tags.
Inspection shows exact version, maturity, dependencies, conflicts, inherited
preset lineage, and resolved composition.

## Recommend

```text
node bin/basic-structure.mjs recommend \
  --capability authentication \
  --capability database \
  --profile fullstack-web
```

The result contains direct providers, the compatible composition including
recursive requirements, matching presets ordered by size, and any uncovered
capabilities. Recommendation is read-only. Review the evidence, then use
`apply-preset`, `add`, or `switch-profile` through their normal plan-first
workflows.

Capability names are lowercase kebab-case. The current taxonomy includes
application surfaces, authentication and sessions, data and PostgreSQL,
observability, email, rate limiting, testing, CI, deployment, containers, and
supply-chain security. New extension authors should reuse an existing term when
the meaning matches and introduce a new term only when it is materially
distinct.

`maturity` may be `experimental`, `beta`, `stable`, or `deprecated`. It helps
explain selection but does not replace code review or security verification.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/capability-catalog-design.md`

