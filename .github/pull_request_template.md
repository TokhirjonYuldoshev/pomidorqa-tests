## Что изменено

<!-- Кратко: одно инженерное изменение и зачем оно нужно. -->

## Класс риска

Отметьте области, которые реально затрагивает PR:

- [ ] Только документация / metadata
- [ ] Unit / бизнес-логика
- [ ] API contract / mock
- [ ] E2E / POM / fixture / helper / test data
- [ ] Dependency / runtime / lockfile
- [ ] CI / GitHub Actions / reporting
- [ ] Security / quality gate
- [ ] Accessibility / performance / visual regression
- [ ] Live registration contract

## Как проверено

Отмечайте только релевантные проверки. Required GitHub checks остаются источником истины для merge readiness.

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] `npm run test:api`
- [ ] E2E / Chromium
- [ ] E2E / Firefox
- [ ] E2E / WebKit
- [ ] Security / dependency checks
- [ ] Релевантный non-functional workflow / diagnostic run
- [ ] Failure artifacts / reports просмотрены, если была ошибка

Evidence / run links:

<!-- Добавляйте ссылки, когда они дают полезный диагностический контекст. -->

## Failure classification

Если PR появился из-за красной проверки, сначала классифицируйте исходный сигнал:

- [ ] Product / contract failure
- [ ] Test / framework defect
- [ ] Environment / external dependency failure
- [ ] Security / dependency failure
- [ ] Observability / notification failure
- [ ] Не применимо

## Quality safeguards

- [ ] Нет `waitForTimeout`, arbitrary sleep, `force: true`, `.only`, `skip` или `page.pause()` ради зелёного CI
- [ ] `retries=0` не ослаблен без документированной причины
- [ ] State-changing сценарии синхронизируются по наблюдаемому UI/network state
- [ ] Новые E2E используют уникальные данные и корректно закрывают созданные browser contexts
- [ ] Assertions остаются на уровне сценария, повторяемые locators/actions — в POM/helpers
- [ ] Temporary diagnostics удалены или осознанно превращены в постоянный workflow с документацией
- [ ] В репозиторий не попали token/password/secret или персональные тестовые credentials
- [ ] README / docs соответствуют фактическому поведению
- [ ] PR не содержит unrelated workaround / scope creep

## Риски / ограничения

<!-- Укажите подтверждённые ограничения. Не маскируйте проблемы внешнего стенда retry/sleep. Если рисков нет — «нет». -->

## Merge decision

См. [`docs/quality-gates.md`](../docs/quality-gates.md): blocking checks, triage model, determinism policy и risk-based evidence.
