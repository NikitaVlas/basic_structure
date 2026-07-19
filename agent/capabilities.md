# Required capabilities

Set `Required` to `yes`, `no`, or `TBD`. Requirements come from project needs,
not from which tools happen to be available.

## Capability matrix

| Capability | Required | Preferred provider | Required operations | Notes |
|---|---|---|---|---|
| Code discovery | TBD | codebase-memory-mcp | Search, trace, snippets | May be omitted for empty or very small repositories |
| Frontend design | TBD | design-taste-frontend | Direction, implementation review | Optional module |
| Figma | TBD | Approved Figma tooling | Generate, read, design-to-code, components | Optional module |
| Unit testing | TBD | Project-native | Run and author tests | |
| Integration testing | TBD | Project-native | Run and author tests | |
| E2E testing | TBD | TBD | Browser/user flows | |
| Visual testing | TBD | TBD | Screenshots and comparison | UI projects only |
| Deployment | TBD | TBD | Build, release, rollback | Requires confirmation |

## External integrations

| System | Required | Operations | Data/secrets | Approval needs |
|---|---|---|---|---|
| GitHub | TBD | TBD | TBD | TBD |

## Gap review

For each missing capability:

1. verify that it is truly required;
2. prefer built-in or already verified tooling;
3. search for the smallest non-overlapping candidate set;
4. audit source, license, scripts, network, secrets, and dependencies;
5. recommend without installing;
6. install only after approval;
7. pin and verify the installed version;
8. record it in `agent/skills-lock.md` or `agent/mcp.md`.

## Document status

- Status: Draft
- Owner:
- Last reviewed:
- Related code: Repository-wide

