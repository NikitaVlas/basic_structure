# Project starter

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
