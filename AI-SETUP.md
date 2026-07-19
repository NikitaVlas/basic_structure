# AI project setup

This starter separates project context, optional modules, and environment-level
tooling. It does not install skills, MCP servers, or dependencies automatically.

## Initialization

1. Fill in `docs/questionnaires/project-init.md`.
2. Fill in `docs/questionnaires/architecture-init.md`.
3. Research the existing repository, if one exists.
4. Complete the documents under `docs/project/`.
5. Complete `docs/architecture/overview.md`.
6. Replace placeholders in `docs/development/verification.md` with real commands.
7. Review and tailor `agent/permissions.md`.
8. Define required capabilities in `agent/capabilities.md`.
9. Review available tools and skills before recommending additions.
10. Record approved skills in `agent/skills-lock.md`.
11. Review the MCP policy and inventory in `agent/mcp.md`.
12. Confirm that the agent can explain the project and its constraints.

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

The optional design pack may contain:

- `docs/design/brief.md`;
- `docs/design/system.md`;
- `docs/design/figma.md`;
- `docs/questionnaires/design-init.md`.

Do not create design documents for projects that do not need them.

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

