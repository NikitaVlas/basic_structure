# Required capabilities

Set `Required` to `yes`, `no`, or `TBD`. Requirements come from project needs,
not from which tools happen to be available.

## Capability matrix

| Capability | Required | Preferred provider | Required operations | Notes |
|---|---|---|---|---|
| Code discovery | TBD | codebase-memory-mcp | Search, trace, snippets | May be omitted for empty or very small repositories |
| Frontend design | no/TBD | design-taste-frontend | Direction, implementation review | Select only when a UI is required |
| UX/product interface review | no/TBD | `docs/design/UX_PRODUCT_PLAYBOOK.md` | UX architecture, accessibility, product-flow review | Select only when a UI or user-facing flow is required |
| Figma | no/TBD | Approved Figma tooling | Generate, read, design-to-code, components | Select only when Figma/design work is required |
| Frontend security | yes | `find-skills` candidate + project-native tooling | XSS, CSRF, auth/session, client-side data exposure, dependency review | Mandatory with frontend code |
| Backend/API security | yes | `find-skills` candidate + project-native tooling | Authorization, validation, injection, secrets, rate limits, logging, dependency review | Mandatory with backend/API code |
| Unit testing | yes | Project-native or approved testing skill | Run and author isolated tests | Required for changed logic |
| Integration testing | yes | Project-native or approved testing skill | Verify module, database, and service boundaries | Required for changed boundaries |
| Contract/API testing | yes | Project-native or approved testing skill | Verify request/response contracts and error behavior | Required when APIs or integrations exist |
| E2E testing | yes | Project-native or approved testing skill | Browser/user flows and critical journeys | Required for user-facing flows; otherwise mark N/A with rationale |
| Visual testing | no/TBD | Project-native or approved testing skill | Screenshots and comparison | Required for visually sensitive UI changes |
| Accessibility testing | no/TBD | Project-native or approved testing skill | Keyboard, semantics, contrast, screen-reader checks | Required when UI exists |
| Deployment | TBD | TBD | Build, release, rollback | Requires confirmation |

## External integrations

| System | Required | Operations | Data/secrets | Approval needs |
|---|---|---|---|---|
| GitHub | TBD | TBD | TBD | TBD |

## Gap review

Выполняйте этот review после сбора информации о проекте и до начала реализации.
Результат поиска skills должен быть предложен пользователю на утверждение.

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
