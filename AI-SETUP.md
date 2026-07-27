# AI project setup

This starter separates project context, optional modules, and environment-level
tooling. It does not install skills, MCP servers, or dependencies automatically.

## Start command

When the user sends the exact phrase `СТАРТ ПРОЕКТА`, begin the initialization
flow. Do not jump straight to implementation. Collect project context, ask the
questionnaire questions in manageable groups, research the repository, run the
skill discovery review, define security and testing gates, and continue only
after the relevant decisions are clear.

## Initialization

Use `README.md` as the entry point and complete
`docs/development/initialization-checklist.md` before feature work.

1. Fill in `docs/questionnaires/project-init.md`.
2. Fill in `docs/questionnaires/architecture-init.md`.
3. Research the existing repository, if one exists.
4. Run the **skill discovery review** after collecting project information.
5. Complete the documents under `docs/project/`.
6. Complete `docs/architecture/overview.md`.
7. Replace placeholders in `docs/development/verification.md` with real commands.
8. Review and tailor `agent/permissions.md`.
9. Define required capabilities in `agent/capabilities.md`.
10. Review available tools and skills before recommending additions.
11. Use the result of the skill discovery review when defining capabilities.
12. Record approved skills in `agent/skills-lock.md`.
13. Review the MCP policy and inventory in `agent/mcp.md`.
14. Run `scripts/check-docs.ps1` and resolve applicable placeholders.
15. Confirm that the agent can explain the project and its constraints.

Before each feature, repeat a scoped skill review if the feature introduces a
new capability. This includes a UI, user-facing flow, new document format,
external integration, deployment concern, testing requirement, or security
requirement. Record the result in `agent/skill-review.md` before implementation
approval.

## Required project flow

Use this order after initialization and for each feature:

1. Collect project, user, business, technical, and constraint information.
2. Run the **skill discovery review** with `find-skills`. Always assess
   frontend security, backend/API security, and testing capabilities; add other
   capabilities only when the project requires them.
3. If an interface or user-facing flow is in scope, select the applicable UX
   review mode and patterns using the project documents in `docs/design/`.
4. Produce UX decisions and acceptance criteria before visual UI work.
5. Define the test plan and security acceptance criteria before implementation.
6. Copy `docs/development/quality-plan-template.md` to a feature-specific path
   such as `docs/development/quality-plans/SPEC-XXXX-quality.md` and approve its threat model,
   coverage matrix, and required checks.
7. Implement the approved scope with frontend/backend security controls.
8. Update the quality plan and add tests covering changed behavior and
   affected boundaries.
9. Run the post-implementation UX audit when UI is in scope.
10. Run the full verification gate: tests, security checks, accessibility/visual
   checks when applicable, build, and documented project checks.
11. Record unresolved findings, coverage gaps, and verification results before
    completion.

The UX sequence is mandatory when UI work is identified:

`need identified -> UX design -> UI implementation -> UX/accessibility audit`

For every project, the delivery sequence also includes:

`requirements -> security design -> implementation -> tests -> security review -> full verification`

No feature is complete without evidence that its changed behavior and relevant
security boundaries are tested. Record the applicable level as not applicable,
unit, integration, contract/API, E2E, or visual.

Use `docs/design/UX_PRODUCT_PLAYBOOK.md` as the project-level UX source of
truth. Use `docs/design/ux-review-template.md` for repeatable reviews and the
pattern catalog, cards, matrix, and preflight checklist when selecting or
checking specific UX patterns. Do not rely on a global copy of the UX skill.

Do not activate UI/UX skills when the project or feature has no interface or
user-facing flow.

## Skill discovery review

После заполнения project questionnaire, исследования репозитория и первичного
описания архитектуры агент обязан проверить, какие специализированные skills
нужны проекту.

1. Составить список задач проекта и required capabilities: например UI/UX,
   документы, spreadsheets, PDF, testing, deployment, GitHub, authentication
   или database.
2. Сравнить список с уже доступными skills в `agent/skills-lock.md`.
3. Для каждой отсутствующей capability использовать `find-skills` с конкретным
   запросом, например `react testing`, `pdf processing` или `accessibility audit`.
4. Проверить кандидатов по источнику, install count, репутации, лицензии,
   зависимостям, сетевому и secret-доступу и пересечениям с текущими tools.
5. Подготовить предложение: capability, skill, назначение, источник,
   ограничения, команда установки и рекомендуемый статус.
6. Передать предложение пользователю на утверждение. Ничего стороннего не
   устанавливать автоматически.
7. После утверждения установить согласованные skills, проверить их работу и
   записать фактическое состояние в `agent/skills-lock.md`.

Результат этапа отражается в `agent/capabilities.md`: каждая capability получает
`Required: yes`, `no` или `TBD`, а также провайдера или причину отсутствия skill.

Use `Unknown`, `Propose options`, or `Not applicable` when an initialization
answer is not yet available. Resolve material open questions before affected
implementation begins.

## Optional modules

Add only modules required by the project:

- design and Figma;
- API;
- database;
- security;
- deployment and infrastructure;
- AI features;
- mobile.

Only when the project questionnaire or feature analysis identifies a user
interface, preserve `docs/design/UX_PRODUCT_PLAYBOOK.md` and include it in the
agent's required context. In that case, use the UX/product and frontend design
skills during the skill discovery review. Do not activate UI/UX skills for
backend-only or infrastructure-only work. The project copy remains the
versioned source of truth when the design module is enabled.

The optional design pack may contain:

- `docs/design/brief.md`;
- `docs/design/system.md`;
- `docs/design/figma.md`;
- `docs/questionnaires/design-init.md`.

Do not create design documents or select UI/UX skills for projects that do not
need an interface.

## Tooling policy

- Prefer built-in and already verified capabilities.
- Audit source, permissions, scripts, network access, secrets, dependencies, and
  overlap before recommending a new skill or MCP server.
- Pin an approved version or commit when possible.
- Verify downloaded executable checksums.
- Never run an unreviewed remote setup script.
- Obtain confirmation before installing third-party skills or executable MCP
  tooling.
- Record actual installed state, not intended state.

## Completion checklist

Initialization is complete when the agent can:

- explain the product purpose, users, goals, and non-goals;
- list major modules and their responsibilities;
- explain allowed dependency directions and data flow;
- name setup, development, test, build, and full verification commands;
- locate where a new feature should be implemented;
- identify required capabilities and current tooling gaps;
- list actions that require user approval;
- identify unresolved decisions and outdated documents.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: YYYY-MM-DD
- Related code: Repository-wide
