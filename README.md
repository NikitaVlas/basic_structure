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
node scripts/init-project.mjs --config project.config.fullstack.example.json --output work/example --dry-run
```

Generate it into a new or empty directory:

```text
node scripts/init-project.mjs --config project.config.fullstack.example.json --output ../example-saas
```

The initializer never overwrites a non-empty output directory. Generated files
and their owning extensions are recorded in `.basic-structure/state.json`.

Available composition primitives are documented in
[`docs/development/extensions.md`](docs/development/extensions.md).

### Configuration

- `project.config.example.json` demonstrates a documentation-only project.
- `project.config.fullstack.example.json` demonstrates the executable web
  profile with shared contracts, observability, PostgreSQL, encrypted durable transactional email,
  account recovery, session management, Docker development services, and
  GitHub CI.
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
