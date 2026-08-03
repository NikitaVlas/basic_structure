# Extension authoring kit design

## Problem

The lifecycle engine is extensible, but authors must currently assemble folder
layout, manifests, fixtures, and validation workflows by hand. Small structural
mistakes are discovered only when an extension participates in project
generation.

## Decision

The CLI provides three local authoring commands:

```text
basic-structure create-extension <profile|module|adapter> <id>
basic-structure validate-extension <profile|module|adapter> <id>
basic-structure test-extension <profile|module|adapter> <id>
```

Creation writes only beneath the matching local extension collection and
refuses an existing destination. The scaffold contains a schema-linked
manifest, `template/`, an author README, and `test/fixture.config.json`.

Validation loads the extension through the production manifest validator,
validates and resolves its fixture, and proves that the fixture selects the
extension under test.

Integration testing initializes the fixture in an isolated temporary directory
and requires a clean upgrade plan. Module and adapter fixtures additionally
perform transactional remove and add round-trips. Profile fixtures prove clean
initialization and upgrade compatibility; profile switching behavior remains
covered by the dedicated profile migration suite.

## Security boundaries

- Kind and id use the strict existing identifier grammar.
- Scaffold destinations are derived from the starter root, never user-supplied
  arbitrary paths.
- Existing extension directories are never overwritten or merged.
- Tests use an isolated temporary directory and remove it afterward.
- Commands do not execute extension code, package managers, Git, network,
  Docker, migrations, or deployment tools.
- Production path, collision, contribution, dependency, state, and rollback
  checks are reused rather than reimplemented.

## Acceptance criteria

1. All three extension kinds receive valid deterministic scaffolds.
2. Existing destinations, invalid kinds, and unsafe ids fail without writes.
3. Validation rejects fixtures that do not select the target extension.
4. Validation reports manifest, dependency, conflict, and fixture failures.
5. Integration tests exercise production initialization and upgrade planning.
6. Module and adapter tests prove remove/add round-trip health.
7. Human and JSON CLI envelopes expose stable evidence.
8. Documentation describes the author workflow and limitations.

## Document status

- Status: Approved
- Owner: Project maintainers
- Last reviewed: 2026-08-03

