# Initialization checklist

Используйте этот checklist перед началом feature-разработки.

## Product

- [ ] Описаны продукт, пользователи, user journey, goals и non-goals.
- [ ] Зафиксированы success criteria, ограничения и открытые вопросы.

## Architecture

- [ ] Описаны компоненты, границы ответственности и dependency rules.
- [ ] Описаны data flow, storage, ошибки, конфигурация и интеграции.
- [ ] Решения, требующие ADR, перечислены отдельно.

## Agent and tooling

- [ ] Проверены permissions и stop conditions.
- [ ] После сбора информации выполнен skill discovery review.
- [ ] Для каждой требуемой capability проверены доступные skills и кандидаты.
- [ ] Пользователю предложены skills для утверждения; автоматическая установка не выполнялась.
- [ ] UI/UX skills выбраны только если проект действительно содержит UI или user-facing flow.
- [ ] Заполнены необходимые capabilities.
- [ ] Фактически доступные skills и MCP отражены в lock/inventory.
- [ ] Для недостающих skills выполнен review через `find-skills`.
- [ ] Результат skill review записан в `agent/skill-review.md`.

## Verification

- [ ] В `docs/development/verification.md` нет применимых `TBD`.
- [ ] Есть setup, development, test, build и full verification commands.
- [ ] Определены обязательные проверки для типов изменений.

## Readiness

- [ ] Существенные open questions закрыты или приняты как риск.
- [ ] Документы имеют владельца и дату последнего review.
- [ ] Агент может объяснить проект и место реализации новой feature.
- [ ] Определено, какие skills активны, доступны или не требуются.

## Feature re-review

- [ ] Перед feature проверено, появились ли новые capabilities.
- [ ] При появлении UI или user-facing flow активированы UX/UI skills.
- [ ] Результат повторной проверки записан в `agent/skill-review.md`.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: YYYY-MM-DD
- Related code: Repository-wide
