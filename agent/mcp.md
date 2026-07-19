# MCP inventory and policy

MCP servers are environment-level tooling, not product documentation. This file
records actual state and verification evidence; it does not install anything.

## Inventory

| Capability | Server | Source | Version | Platform | Status | Verification | Notes |
|---|---|---|---|---|---|---|---|
| Codebase intelligence | codebase-memory-mcp | TBD | TBD | TBD | required | TBD | Optional for empty, tiny, unsupported, or policy-restricted repositories |

Allowed statuses: `required`, `reviewed`, `approved`, `installed`, `verified`,
`rejected`, and `unavailable`.

## Codebase intelligence usage

When available and current:

1. Search the graph for functions, classes, routes, and variables.
2. Trace inbound and outbound dependencies for impact analysis.
3. Read specific relevant snippets.
4. Use text search for configuration, documentation, strings, errors, and
   unsupported files.
5. Verify uncertain results against source.
6. Do not treat a stale index as a source of truth.

## Safe bootstrap checklist

Do not execute installation automatically. After explicit approval:

1. Confirm the server is not already installed.
2. Detect the current platform and architecture.
3. Select a pinned release from a reviewed source.
4. Download the release without executing it.
5. Verify the published checksum or signature.
6. Inspect required permissions, paths, network, and secrets.
7. Add the minimal MCP configuration without embedding secrets.
8. Start the server and enumerate expected tools.
9. Run a harmless verification operation.
10. Index the project only when policy permits it.
11. Record version, source, checksum, and verification result above.

Never install an unpinned `latest` release or directly execute an unreviewed
remote setup script.

## Exceptions

The MCP may be omitted when:

- the repository is empty or very small;
- its languages are unsupported;
- organization policy prohibits indexing or third-party binaries;
- the environment is technically incompatible;
- the expected benefit does not justify the additional executable tooling.

Record the reason and the fallback discovery method in the inventory.

## Document status

- Status: Draft
- Owner:
- Last reviewed:
- Related code: Repository-wide

