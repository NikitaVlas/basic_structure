# AI engineering harness

## Definition

The AI engineering harness is the repository layer that constrains how an
agent discovers context, makes decisions, changes files, and proves completion.
It is not the generated application's runtime and it is not a deployment
platform.

```text
basic_structure
├── harness: agent rules, questionnaires, workflow, specifications, quality gates
├── generator: profiles, modules, adapters, composition and state
└── baselines: generated application and operational capabilities
```

The harness drives the generator. The generator composes runtime baselines.
Runtime code must not import or depend on harness documents.

## Responsibilities

The harness owns:

- context collection and explicit product decisions;
- permissions and safe operating boundaries;
- architectural and security specifications before implementation;
- incremental work with reviewable commit suggestions;
- tests, documentation checks, security audits, builds, and smoke evidence;
- handoff of residual risks and operator procedures;
- safe lifecycle upgrades with plan-first conflict detection and verification.

Profiles own application shape, modules own portable capabilities, and adapters
own platform-specific integration. Docker production deployment is therefore an
adapter: selecting it must not make PostgreSQL, authentication, email, or
observability intrinsically dependent on Docker.

## Deployment workflow

For a deployment change, the harness shall require:

1. an architecture and threat-boundary specification;
2. explicit environment and secret contracts;
3. non-root, minimal runtime images and deterministic build inputs;
4. liveness, readiness, migration, startup, shutdown, and rollback behavior;
5. automated static and runtime smoke checks;
6. operational documentation and residual-risk disclosure.

## Non-goals

- The harness does not deploy automatically without user authorization.
- It does not store production credentials.
- It does not choose a cloud vendor implicitly.
- It does not make every generated project use the full-stack profile.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/development/workflow.md`
