# Local capability catalog design

## Decision

Extensions and presets publish normalized `capabilities`, searchable `tags`, and
`maturity`. The local CLI indexes only reviewed files in the starter repository:

```text
basic-structure search <query>
basic-structure inspect <profile|module|adapter> <id>
basic-structure inspect-preset <id>
basic-structure recommend --capability <id> [--profile <id>]
```

Search matches identity, name, description, capability, and tag. Preset
inspection resolves inherited metadata and the capabilities of every selected
extension.

Recommendation uses deterministic greedy set coverage, resolves recursive
requirements through the production configuration engine, reports uncovered
capabilities, and ranks complete preset matches by resolved extension count.
It provides evidence, not an automatic project mutation.

## Security boundaries

- No network, registry, telemetry, dynamic loading, or extension execution.
- Metadata identifiers use strict lowercase kebab-case validation.
- Compatibility, conflicts, cycles, and versions use existing fail-closed
  resolvers.
- Recommendation never writes configuration or project files.
- Maturity is descriptive evidence, not a security guarantee.

## Acceptance criteria

1. All built-in entries publish complete metadata.
2. Search is deterministic and supports kind filtering.
3. Inspection exposes versions, capabilities, requirements, and composition.
4. Preset capabilities include inherited selected extensions.
5. Recommendation explains providers and recursive composition.
6. Complete presets are ranked by minimal resolved extension count.
7. Unsupported capabilities are explicitly reported as uncovered.
8. Human and JSON CLI behavior is tested.

## Document status

- Status: Implemented
- Owner: Project maintainers
- Last reviewed: 2026-08-03

