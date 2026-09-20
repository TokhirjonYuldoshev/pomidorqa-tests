# Обязательные проверки качества

Документ фиксирует правила защиты `main` и различие между блокирующими и диагностическими сигналами.

## Защита `main`

Активный ruleset: `Protect main`.

Он запрещает удаление и non-fast-forward обновление защищённой ветки, требует Pull Request, разрешение обсуждений, линейную историю и только **squash merge**.

Проверки выполняются в строгом режиме относительно актуального `main`.

## Локальный quality gate

Перед отправкой крупного изменения можно выполнить полный локальный gate:

```bash
npm run gate
```

Он запускает runtime check, lint, typecheck, проверку матрицы покрытия, Unit, API и E2E в fail-fast цепочке: дорогой браузерный уровень начинается только после дешёвых статических и нижележащих проверок.

Для полного прогона с JSON-метриками используется:

```bash
npm run regression:metrics
```

## Обязательные проверки

| Проверка GitHub | Что подтверждает |
| --- | --- |
| `Quality / lint + typecheck` | ESLint, машинную проверку CODEX-инвариантов, TypeScript и автоматическую валидацию requirement coverage |
| `Unit tests` | чистую бизнес-логику |
| `API tests` | локальные HTTP-контракты и live test API регистрации PomidorQA |
| `E2E / Chromium` | пользовательские сценарии в Chromium |
| `E2E / Firefox` | пользовательские сценарии в Firefox |
| `E2E / WebKit` | пользовательские сценарии в WebKit |
| `Security / npm audit` | отсутствие блокирующих npm-уязвимостей |
| `Security / dependency change review` | согласованность изменений зависимостей и lockfile |
| `Security / code quality` | независимую статическую проверку кода |

Внутри Quality выполняются `npm run codex:check` и `npm run coverage:check`. `codex:check` блокирует PR при смешивании action/assertion внутри `test.step`, UI-регистрации вне registration-specific coverage, прямых локаторах в E2E spec, запрещённых `waitForTimeout` / `force: true` / `.only` / `skip` / `page.pause()` и прямом создании `BrowserContext` в spec. `coverage:check` блокирует PR, если отсутствует любой из 50 requirement ID, встречается недопустимый/дублирующийся статус, матрица ссылается на несуществующий spec-файл или цифры README расходятся с матрицей. Там же выполняется `node scripts/ai-review-self-check.mjs`, который проверяет reviewer policy engine, и `npm run ci:policy`, который машинно фиксирует CI-инварианты: 10 custom workflows, полный SHA pin для remote actions, отсутствие `pull_request_target`, `retries=0`, основной E2E `workers=4` + `max-parallel: 2`, локальный `test:e2e:fast` не выше 4 workers, обязательные browser/gate/summary/Telegram сигналы, trusted `main` checkout AI Review и non-blocking artifact transport.

### Агрегированный Regression Gate

`Regression Gate` выполняется после browser matrix и даёт один стабильный итог функционального CI. Он не входит в текущий список required status checks ruleset `Protect main` и не заменяет их. При расследовании источником истины остаётся конкретный исходный job: Quality, Unit, API или соответствующий браузер.

Если одна из обязательных проверок красная, связанное изменение не готово к слиянию.

## Диагностические проверки

| Сигнал | Назначение |
| --- | --- |
| Accessibility Audit | WCAG/axe-core; обычный режим информационный |
| Performance Smoke / Lighthouse | показатели публичных страниц |
| Visual Regression | изменения внешнего вида |
| Nightly E2E Regression | регрессии внешнего стенда вне конкретного PR |
| Stability Check | повторные прогоны с `retries=0` |
| Registration Contract Smoke | ручная проверка контракта регистрации |
| AI Review | CODEX-scoped проверка PR после зелёного CI: deterministic preflight только по Playwright-коду, второй валидационный проход, requirement traceability, provenance, degraded mode, Actions Summary и отдельная Telegram job |
| Telegram Notification Test | ручная диагностика уведомлений |

Диагностический сигнал не подменяет обязательную проверку. `CI Summary` служит обзорным dashboard и агрегирует machine-readable browser reports, но источником pass/fail остаются сами jobs.

## Детерминированность

Для live E2E, Nightly и Stability сохраняется `retries=0`. В основном PR/push CI browser matrix дополнительно ограничена `max-parallel: 2`; это контроль нагрузки внешнего стенда, а не повтор тестов.

Нельзя получать зелёный результат за счёт `waitForTimeout`, произвольных пауз, `force`, `.only`, `skip`, постоянного увеличения таймаутов или многократного повторного запуска без диагностики.

## Данные для разбора

В зависимости от проверки сохраняются:

- Playwright HTML;
- Allure;
- trace, screenshots, video;
- `test-results`;
- результаты `npm audit`;
- CycloneDX SBOM;
- отчёты accessibility/Lighthouse;
- визуальные различия;
- итог Registration Contract Smoke;
- GitHub Actions Summary;
- агрегированный CI Dashboard по Chromium / Firefox / WebKit;
- AI Review Dashboard с моделью, changed/reviewed/ignored files, размером diff, deterministic findings, связанными requirement ID, upstream CI, trusted reviewer revision, policy fingerprint, числом findings, распределением P1/P2/P3, token usage и ссылкой на опубликованный review;
- отдельные Telegram jobs для основного CI и AI Review.

Artifacts нужны для расследования и не меняют фактический pass/fail. Upload диагностических artifacts во всех custom workflows, а также генерация отчётов после завершения основной проверки, выполняются как non-blocking transport steps. Это правило распространяется на основной CI, Nightly, Stability, Accessibility, Lighthouse, Visual и Registration Contract Smoke. Сетевой сбой GitHub artifact storage остаётся наблюдаемой проблемой отчётности и не превращает успешную проверку в ложный regression signal. Machine-readable отчёты могут из-за этого отсутствовать; такой случай расследуется как reporting degradation, а не как изменение фактического test result.

## Изменения зависимостей

Dependabot проходит те же правила. Major-обновление не должно сливаться только потому, что его предложил автоматический бот: требуется проверка совместимости и обычный CI.

## Минимум по типу изменения

| Тип изменения | Минимальный сигнал |
| --- | --- |
| документация | отсутствие ложных утверждений и зелёные обязательные checks |
| Unit/API | Quality + затронутый уровень + обязательные checks |
| E2E/Page Object/helper/fixture | Quality + три браузерных E2E |
| зависимость/runtime | security + Quality + Unit/API + три браузера |
| workflow | сохранение обязательных имён checks и проверка изменённой логики |
| нефункциональная проверка | соответствующий workflow плюс функциональный CI при изменении поведения кода |

## Решение о слиянии

PR готов, когда:

- обязательные проверки зелёные на текущем head;
- обсуждения разрешены;
- причина предыдущих сбоев не скрыта;
- документация соответствует реализации;
- в PR нет несвязанного обходного решения.

Главный принцип: независимые и объяснимые сигналы важнее одного зелёного значка.