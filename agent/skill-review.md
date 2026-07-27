# Skill review

Этот документ фиксирует результат проверки skills для конкретного проекта.
Review выполняется после сбора информации о проекте и повторяется перед
feature, если меняется scope или появляются новые capabilities.

## Project profile

- Project type:
- User interface required: no / yes / unknown
- User-facing flows: no / yes / unknown
- Figma or visual design required: no / yes / unknown
- Review date: YYYY-MM-DD
- Reviewer:

## Required capabilities

| Capability | Required | Why it is needed | Existing provider | Gap |
|---|---|---|---|---|
| Frontend security | yes when frontend exists | Prevent XSS, CSRF, client-side data exposure, and unsafe dependencies | Project-native tooling + candidate skill | Candidate requires review |
| Backend/API security | yes when backend/API exists | Protect authorization, validation, secrets, injection, rate limits, and dependencies | Project-native tooling + candidate skill | Candidate requires review |
| Unit/integration testing | yes | Verify changed logic and module/service boundaries | Project-native test framework | Framework depends on stack |
| Contract/API testing | yes when APIs/integrations exist | Verify schemas, status codes, errors, and compatibility | Candidate skill + project-native tooling | Candidate requires review |
| E2E testing | yes for user-facing flows | Verify critical journeys in a realistic environment | Candidate skill + project-native tooling | Candidate requires review |
| Accessibility testing | yes when UI exists | Verify keyboard, semantics, contrast, and assistive technology behavior | Candidate skill + project-native tooling | Candidate requires review |

## Candidate skills

| Capability | Skill | Source | Evidence reviewed | Recommendation | Approval |
|---|---|---|---|---|---|
| Frontend security | frontend-security | `schalkneethling/webdev-agent-skills` | 318 installs; skills.sh search result | Review as focused frontend candidate | Pending |
| Backend/API security | api-security-design | `vinayaklatthe/microsoft-security-skills` | 58 installs; skills.sh search result; source name suggests Microsoft security focus | Review cautiously; verify repository and license before approval | Pending |
| Full-stack security | fullstack-guardian | `jeffallan/claude-skills` | 4K installs; GitHub repository has 9.4K stars, MIT license, documented security workflows | Approved primary security candidate for frontend/backend security | Approved |
| E2E testing | Project-native browser testing | Project stack | Use the project's verified browser framework; select it after stack discovery | Required for user-facing flows | Pending |
| E2E testing | playwright | `secondsky/claude-skills` | 777 installs; 194 GitHub stars; MIT; pinned main commit `c4889f61f4f49b2d1770cb957ed572674b68ac47`; dedicated Playwright browser automation and E2E workflow | Conditional candidate: strong content, but repository lists Claude Code/Factory as native and points other platforms to OpenPackage; requires Codex compatibility validation | Pending |
| Contract/API testing | contract-testing | `proffesor-for-testing/agentic-qe` | Specialized contract-testing skill; repository exposes testing, security, and coverage tooling | Stronger candidate than prompt-only collection; verify scope before approval | Pending |
| Accessibility testing | accessibility-testing | `aj-geddes/useful-ai-prompts` | 513 installs; GitHub describes repository as curated AI prompts | Do not approve as primary skill without reviewing contents; prefer a dedicated accessibility testing source | Pending |
| Accessibility testing | accessibility-agents | `Community-Access/accessibility-agents` | GitHub documents WCAG 2.2 AA agents and explicitly says they do not replace real testing; MIT license | Strong candidate for review, with manual/automated testing retained | Pending |
| Unit/integration testing | project-native testing framework | Project stack | No external skill selected; project framework is preferred | Use native framework first; search only if a gap remains | Pending |

## Activation decisions

| Skill | Activation | Scope or reason |
|---|---|---|
| Project UX playbook | not-required | Use `docs/design/UX_PRODUCT_PLAYBOOK.md` only when UI or user-facing flow is identified |
| design-taste-frontend | not-required | Activate only when frontend implementation is required |
| frontend-security | proposed | Default security gate when frontend code exists; awaiting review and approval |
| api-security-design | proposed | Default security gate when backend/API code exists; awaiting review and approval |
| fullstack-guardian | active | Approved and installed; use for full-stack security implementation and review |
| Project-native browser testing | proposed | Select after stack discovery; required for user-facing flows |
| playwright | proposed | Conditional replacement candidate; requires Codex compatibility validation and approval |
| api-contract-testing | proposed | Default contract gate when APIs/integrations exist; awaiting review and approval |
| accessibility-testing | proposed | Default accessibility gate when UI exists; awaiting review and approval |

Allowed activation values:

- `active` — selected and used in the current project or feature;
- `available` — reviewed and available, but not currently needed;
- `not-required` — explicitly unnecessary for the current scope;
- `proposed` — recommended, awaiting user approval.

## Feature re-review

Before each feature, check whether it introduces a new interface, user-facing
flow, document type, integration, deployment concern, testing need, or security
requirement. If yes, repeat the gap review and use `find-skills` before
implementation approval.

## External skill compatibility gate

Before approving an external skill for Codex, record:

- pinned repository commit or release;
- supported agent platforms and any adapter requirement;
- frontmatter and invocation compatibility with Codex;
- scripts, dependencies, network access, and secret access;
- installation result and a minimal smoke-test result.

If compatibility is uncertain, keep the skill `proposed` or `blocked`. Use
project-native tooling as the default implementation path.

## Document status

- Status: Draft
- Owner:
- Last reviewed:
- Related code: Repository-wide

