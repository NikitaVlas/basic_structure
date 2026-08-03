# Project starter

This repository is both a stack-neutral AI delivery framework and an
executable project generator. It separates durable process rules from
selectable application profiles, modules, and external-platform adapters.

## Executable quick start

Requirements: Git and Node.js 22.12 or newer. The starter itself has no runtime
dependencies; the current full-stack profile uses the same supported baseline.

Validate the starter:

```text
npm test
node scripts/verify.mjs --mode template
```

Preview a generated full-stack project without writing output:

```text
node bin/basic-structure.mjs init --config project.config.fullstack.example.json --output work/example --dry-run
```

Generate it into a new or empty directory:

```text
node bin/basic-structure.mjs init --config project.config.fullstack.example.json --output ../example-saas
```

Preview and apply starter updates to an existing generated project:

```text
node bin/basic-structure.mjs update --project ../example-saas --plan
node bin/basic-structure.mjs update --project ../example-saas --apply
```

The updater preserves user-only edits, blocks concurrent changes, backs up
replaced or retired files, and records an operation report. See
[`project upgrades`](docs/development/project-upgrades.md).
The complete command and JSON contract is documented in the
[`lifecycle CLI guide`](docs/development/lifecycle-cli.md).

The initializer never overwrites a non-empty output directory. Generated files,
their owning extensions, exact extension versions, and SHA-256 baselines are recorded in
`.basic-structure/state.json`.

Available composition primitives are documented in
[`docs/development/extensions.md`](docs/development/extensions.md).
Their supported version combinations are published in the
[`extension compatibility matrix`](docs/development/extension-compatibility.md).

### Configuration

- `project.config.example.json` demonstrates a documentation-only project.
- `project.config.fullstack.example.json` demonstrates the executable web
  profile with shared contracts, observability, PostgreSQL, encrypted durable transactional email,
  account recovery, distributed Valkey rate limiting, session management, Docker development services, and
  isolated Playwright account-security journeys, and GitHub CI.

The observability baseline includes correlated JSON logs, safe error
fingerprints, Prometheus-compatible API/worker metrics, liveness/readiness
probes, and graceful service shutdown. Operational guidance is in
[`docs/development/observability-operations.md`](docs/development/observability-operations.md).

The optional `docker-production` adapter turns that runtime baseline into
hardened API/worker and web images with private dependencies, migration gates,
health checks, and CI smoke validation. It is governed by the
[`AI engineering harness`](docs/architecture/ai-engineering-harness.md) and
documented in
[`production deployment`](docs/development/production-deployment.md).

The optional `github-security` adapter enforces repository and image security
gates while the harness supplies the reusable
[`threat model`](docs/security/threat-model.md) and
[`vulnerability response`](docs/security/vulnerability-response.md).
- `schemas/project-config.schema.json` is the versioned configuration contract.

Copy an example to `project.config.json`, record real product decisions, and
then initialize the project. Do not edit generated state by hand.

## Start command

Use the exact phrase `СТАРТ ПРОЕКТА` to begin a new project initialization with
the AI agent. The agent then collects context, asks the initialization
questions, researches the repository, runs `find-skills`, defines security and
testing requirements, and follows the documented workflow step by step.

Базовая структура для быстрого и качественного старта проекта с AI-агентом.

## С чего начать

1. Заполнить `docs/questionnaires/project-init.md`.
2. Исследовать существующий репозиторий и заполнить архитектурную анкету.
3. Заполнить `docs/project/` и `docs/architecture/overview.md`.
4. Настроить `agent/permissions.md`, `agent/capabilities.md` и tooling.
5. Заменить применимые `TBD` в `docs/development/verification.md`.
6. Запустить `scripts/check-docs.ps1`.
7. Провести readiness review по `docs/development/initialization-checklist.md`.

## Карта структуры

| Каталог | Назначение |
|---|---|
| `docs/project/` | Цели, границы, требования и ограничения |
| `docs/architecture/` | Архитектура и ADR |
| `docs/development/` | Workflow, verification, testing и DoD |
| `docs/design/` | UX и accessibility для проектов с интерфейсом |
| `docs/questionnaires/` | Вопросы инициализации |
| `docs/specifications/` | Шаблоны feature specifications |
| `agent/` | Capabilities, permissions, skills и MCP |
| `tasks/` | Активные и завершённые задачи |

Результат подбора и активации skills хранится в `agent/skill-review.md`, а
фактическое состояние проверенных skills — в `agent/skills-lock.md`.

## Optional modules

`docs/design/` и UI/UX skills подключаются только после выявления UI или
user-facing flow. Для backend-only и infrastructure-only проектов они не нужны.
API, database, security, deployment, AI и mobile документы добавляются только
при наличии соответствующего модуля.

## Поиск дополнительных skills

Для подбора внешнего skill используется `find-skills`. Он помогает найти и
проверить подходящий skill; установка сторонних skills требует подтверждения и
фиксируется в `agent/skills-lock.md`.
