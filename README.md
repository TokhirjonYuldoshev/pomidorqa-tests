# PomidorQA — автоматизация тестирования

[![Playwright QA Automation CI](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/playwright.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/playwright.yml)
[![Nightly E2E Regression](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/nightly.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/nightly.yml)
[![Security & Quality Gates](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/security.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/security.yml)
[![Stability Check](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/stability.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/stability.yml)
[![Accessibility Audit](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/accessibility.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/accessibility.yml)
[![Performance Smoke / Lighthouse](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/performance.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/performance.yml)
[![Visual Regression](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/visual.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/visual.yml)

Портфельный проект по автоматизации тестирования сервиса PomidorQA на **Playwright + TypeScript**. Ключевые продуктовые риски — потеря/смешивание пользовательской сессии, двойное бронирование одного слота, некорректная доступность в каталоге, ошибки часового пояса и нарушение окна отмены. Репозиторий развивает учебный проект в самостоятельную тестовую систему с функциональными, CI/CD и нефункциональными сигналами качества.

Исходный учебный репозиторий: [lebed52/pomidorqa-course-tests](https://github.com/lebed52/pomidorqa-course-tests).

## Покрытие требований — HW16

Источник требований — [`requirements.md`](requirements.md), а подробное соответствие «требование → тест → статус» находится в [`docs/coverage-matrix.md`](docs/coverage-matrix.md).

| Метрика | Значение |
| --- | ---: |
| Требований MVP | 50 |
| Полнота аудита | **50 / 50 (100%)** |
| `automated` | **45 / 50 (90%)** |
| `partial` | 2 / 50 (4%) |
| `known defect` | 1 / 50 (2%) |
| `out of scope` | 2 / 50 (4%) |
| Unit | 10 |
| API | 11 |
| E2E | 100 |
| Всего автоматизированных проверок | **121** |

### Время прогонов и стабильность CI

Длительность не хранится как постоянная характеристика проекта: `CI Summary` рассчитывает её заново для каждого запуска по machine-readable отчётам трёх браузеров.

Контрольный post-merge запуск `main` #282 (`35453857843`) завершился успешно с первого attempt уже с текущей browser policy `workers=4`, `retries=0`, `max-parallel: 2`. Wall-clock browser jobs составили примерно **5 мин 26 с для Chromium**, **6 мин 33 с для Firefox** и **6 мин 42 с для WebKit**. WebKit стартовал после освобождения одного из двух matrix slots — это ожидаемое следствие ограничения пиковой нагрузки live-стенда.

Актуальные длительности, expected/unexpected failures, flaky/retried counters и самые медленные сценарии нужно смотреть в `CI Summary` конкретного запуска.

Число тестов, автоматизированное покрытие и полнота аудита — разные метрики. Все 50 требований классифицированы; 45 имеют статус `automated`, два остаются `partial`, два `out of scope`, один — `known defect`. API-мок используется для автоматизированной проверки бизнес-контрактов бронирования на уровне API и не выдаётся за прямое исполнение production-кода PomidorQA. Единственный известный дефект матрицы — R8.3: каталог сейчас учитывает `want_to_learn`, хотя требование ограничивает фильтр навыками `can_help`. Регрессионные проверки написаны по требованию и оформлены как `test.fail()`.

## Что реализовано

| Область | Реализация |
| --- | --- |
| Unit | проверки чистой бизнес-логики без браузера |
| API | локальные HTTP-контракты + live test API регистрации PomidorQA |
| E2E | реальные пользовательские сценарии PomidorQA |
| Браузеры | Chromium, Firefox и WebKit |
| Архитектура | Page Object Model, fixtures, helpers, уникальные тестовые данные |
| Подготовка данных | создание тестовых аккаунтов через API там, где UI-регистрация не является предметом проверки |
| Очистка данных | централизованное удаление созданных тестовых аккаунтов перед закрытием `BrowserContext` |
| Отчёты | Playwright HTML, Allure, JSON/JUnit, trace, screenshots, video; транспорт отчётов не подменяет результат тестов, а Actions Dashboard агрегирует три браузера, failures, slowest tests, artifacts и coverage |
| Доступность | axe-core / WCAG |
| Производительность | Lighthouse |
| Визуальные проверки | сравнение скриншотов в Chromium |
| Безопасность | `npm audit`, проверка изменений зависимостей, CycloneDX SBOM |
| Стабильность | повторные прогоны с `retries=0` и отдельной таблицей метрик |
| Traceability | автоматическая проверка 50 requirement ID, статусов, test-ссылок и синхронизации README ↔ matrix |
| Regression Gate | агрегирует Quality + Unit + API + E2E matrix в один понятный итоговый сигнал перед Summary |
| AI Review | Gemini-review после зелёного PR CI + ручной запуск; trusted-main архитектура, детерминированный preflight без docs false positives, второй валидационный проход, traceability requirement ID, graceful `degraded` mode при временной недоступности Gemini, P1/P2/P3, upstream CI, reviewer revision, policy fingerprint, отдельная Telegram job и Actions Dashboard |
| Плановые проверки | Nightly E2E |
| Уведомления | Telegram как вспомогательный канал, не источник результата тестов |

## Функциональное покрытие

### Авторизация и сессии

Проверяются успешный и ошибочный вход, восстановление после неверного пароля, сохранение сессии после перезагрузки, выход, защита страниц профиля/встреч/слотов, независимость нескольких браузерных контекстов и отсутствие влияния выхода одного пользователя на сессию другого.

### Профиль

Проверяются имя, Telegram, описание, часовой пояс, оба типа навыков, сохранение после перезагрузки, удаление навыков, несколько навыков, независимость полей, последнее сохранённое значение и изоляция состояния разных аккаунтов.

### Свободные слоты

Проверяются пустое начальное состояние, создание и сохранение слотов, несколько времён в один день, несколько дат, видимость доступных времён гостю и изоляция слотов разных аккаунтов.

### Каталог и поиск

Покрыты положительные и отрицательные сценарии поиска, точное и частичное совпадение, регистр, пробелы, Enter, кириллица и специальные символы, многословные навыки, одинаковые имена/навыки, скрытие собственной карточки, обновление выдачи после изменения профиля, удаления аккаунта, появления/исчезновения слотов и каскадных изменений связанных сущностей. Расхождение фильтрации `can_help` / `want_to_learn` не маскируется зелёным тестом и зафиксировано как known defect R8.3.

### Бронирование и отмена

Проверяются основной путь бронирования, гонка двух пользователей за один слот, отображение встречи у обеих сторон, отмена, сохранение отменённого состояния после перезагрузки, исчезновение хоста при занятии последнего слота, восстановление доступности после отмены и повторное бронирование освобождённого слота другим пользователем.

## Архитектура

```text
src/pyramid/              чистая логика и локальный mock API

tests/
├── unit/                 модульные проверки
├── api/                  HTTP-проверки
├── e2e/                  пользовательские сценарии
├── fixtures/             управление контекстами
├── helpers/              данные и подготовка состояния
├── pages/                Page Objects
└── visual/               визуальные проверки

scripts/                  вспомогательные проверки
docs/                     инженерная документация
.github/workflows/         CI и отдельные проверки качества
```

Главное разделение ответственности:

**сценарий и проверки — в spec → действия экрана — в Page Object → подготовка данных и повторяемые действия — в helpers → создание и очистка контекстов — в fixtures**.

## Работа с тестовыми данными

Каждый сценарий использует уникальные данные. Многопользовательские проверки работают в отдельных `BrowserContext`.

Когда регистрация не является предметом теста, аккаунт создаётся через тестовый API. Контекст, в котором создан тестовый аккаунт, помечается для очистки; teardown удаляет аккаунт и затем закрывает браузерный контекст. Удаление аккаунта каскадно очищает связанные тестовые навыки, слоты и бронирования.

Это снижает нагрузку на общий стенд и не оставляет новые тестовые данные после обычных E2E-прогонов.

## Синхронизация и стабильность

Не используются как способ «починить» тест:

- `waitForTimeout` и произвольные паузы;
- `force: true`;
- `.only` и `skip`;
- `page.pause()`;
- автоматические повторные попытки, скрывающие первый сбой.

Основные E2E, Nightly и Stability сохраняют `retries=0`.

Изменяющие состояние действия подтверждаются наблюдаемыми сигналами: HTTP-ответом нужного запроса, переходом по URL, появлением/исчезновением состояния интерфейса или ограниченным повторным опросом там, где подтверждена eventual consistency.

## CI и защита `main`

`main` защищён ruleset `Protect main`. Разрешено только слияние через Pull Request и **squash merge**. Обязательны разрешённые обсуждения и актуальные проверки относительно последнего `main`.

Quality job дополнительно запускает три машинных инварианта: `npm run coverage:check` проверяет все 50 requirement ID и синхронизацию coverage; `scripts/ai-review-self-check.mjs` проверяет policy engine AI Review; `npm run ci:policy` валидирует 10 workflow-файлов — SHA-pinning GitHub Actions, `retries=0`, browser matrix `max-parallel: 2`, обязательные browser/gate/summary/Telegram сигналы, trusted checkout AI Review и non-blocking diagnostic artifact uploads. Поэтому ключевые правила CI нельзя незаметно ослабить простой правкой YAML.

Обязательные проверки:

- `Quality / lint + typecheck`;
- `Unit tests`;
- `API tests`;
- `E2E / Chromium`;
- `E2E / Firefox`;
- `E2E / WebKit`;
- `Security / npm audit`;
- `Security / dependency change review`;
- `Security / code quality`.

Для браузерных E2E в CI используются `workers=4`, `retries=0`, `fail-fast: false` и `max-parallel: 2` на browser matrix. Chromium, Firefox и WebKit остаются отдельными jobs, но одновременно выполняются максимум два браузера. Ограничение введено после повторяемых HTTP 502/timeout на live-стенде при трёх параллельных browser jobs; изолированный Chromium на тех же `workers=4` прошёл полностью. Это сохраняет внутрибраузерный параллелизм, но снижает пиковую нагрузку с 12 до 8 E2E workers.

После browser matrix выполняется `Regression Gate`. Он не заменяет исходные checks и не скрывает их результат: job только агрегирует обязательные функциональные сигналы в один статус, после чего запускаются `CI Summary` и `Telegram Notification`.

## Отдельные проверки качества

- **Accessibility Audit** — axe-core и WCAG;
- **Performance Smoke / Lighthouse** — производительность и технические показатели публичных страниц;
- **Visual Regression** — визуальные изменения login/register;
- **AI Review** — CODEX-scoped review после успешного PR CI; workflow использует доверенный код из `main`, выполняет детерминированный preflight только по Playwright-коду, второй проход для отсечения ложных замечаний, показывает связанные requirement ID по coverage matrix, P1/P2/P3, upstream CI, trusted reviewer revision и policy fingerprint; временный 408/429/5xx Gemini переводит review в честный `degraded` mode, а отдельная Telegram job доставляет состояние; поддерживаются draft PR и ручной запуск по номеру PR;
- **Nightly E2E Regression** — плановая проверка внешнего стенда;
- **Stability Check** — повторные запуски без retries;
- **Registration Contract Smoke** — ручная проверка `POST /pomidorqa/auth/register → 303 → /pomidorqa`;
- **Telegram Notification Test** — ручная диагностика интеграции Telegram.

Эти сигналы отделены от функционального E2E, чтобы причина сбоя оставалась понятной.

## Отчёты и диагностика

Playwright формирует HTML, Allure, JSON и JUnit. При ошибках сохраняются trace, screenshots, video и `test-results`. В основном CI, Nightly, Stability, Accessibility, Lighthouse, Visual и Registration Contract Smoke доставка диагностических artifacts отделена от результата самой проверки: сетевой сбой GitHub artifact storage не превращает успешную проверку в ложное функциональное падение. Nightly и Stability дополнительно сохраняют machine-readable JSON/JUnit для разбора метрик. Пример причины, из-за которой это разделение введено: в post-merge CI #262 attempt 1 Chromium завершил `100 passed`, а исходный job стал красным только при финализации HTML artifact из-за `ECONNRESET`. Attempt 2 позже показал уже независимый сбой live-стенда — `ECONNREFUSED` на test-account API; разные attempts классифицируются по фактической первой причине, а не объединяются под общим словом «flaky».

Каждый browser job публикует собственные метрики, `Regression Gate` агрегирует обязательные функциональные сигналы, а финальный `CI Summary` скачивает machine-readable отчёты Chromium/Firefox/WebKit и строит единый Actions Dashboard: статус gates, номер attempt, 50/50 requirement audit, test inventory, browser matrix, expected/unexpected failures, flaky/retries, slowest scenarios, data-discipline и прямые ссылки на artifacts. Отсутствующий artifact остаётся диагностическим ухудшением и виден в Summary, но не переписывает фактический test result.

Telegram используется только для доставки результата. Если отправка уведомления не удалась, это не меняет фактический статус тестов или проверки безопасности.

## Быстрый старт

Требования: Node.js 24, npm и Chromium.

```bash
git clone https://github.com/TokhirjonYuldoshev/pomidorqa-tests.git
cd pomidorqa-tests
npm ci
npx playwright install chromium
npm run verify:local
```

Для E2E:

```bash
npm run test:e2e
```

Для быстрого локального E2E-прогона:

```bash
npm run test:e2e:fast
```

Для другого браузера:

```bash
E2E_BROWSER=firefox npm run test:e2e
E2E_BROWSER=webkit npm run test:e2e
```

## Основные команды

| Команда | Назначение |
| --- | --- |
| `npm run verify:local` | быстрый локальный gate: Node 24 + ESLint + TypeScript + coverage + CI policy + Unit + API |
| `npm run gate` | полный gate: runtime + lint + typecheck + Unit + API + E2E |
| `npm run regression:metrics` | полный Playwright-прогон и инженерная сводка метрик |
| `npm run metrics` | разобрать последний JSON-отчёт Playwright |
| `npm run coverage:check` | проверить 50/50 требований, статусы, test references и синхронизацию README ↔ matrix |
| `npm run ci:policy` | проверить инварианты GitHub Actions: pinned actions, retries, matrix load, trusted review и diagnostic transport |
| `npm run lint` | статический анализ ESLint |
| `npm run typecheck` | проверка типов TypeScript |
| `npm run test:unit` | Unit |
| `npm run test:api` | API |
| `npm run test:e2e` | E2E в выбранном браузере |
| `npm run test:e2e:fast` | локальный E2E с ограниченным параллелизмом: 4 workers, `retries=0` |
| `npm test` | все проекты Playwright |
| `npm run report` | открыть Playwright HTML report |
| `npm run allure:generate` | собрать Allure report |
| `npm run allure:open` | открыть Allure report |

По умолчанию используется `https://aiqa.su`. Адрес можно переопределить через `POMIDORQA_BASE_URL`.

## Документация

- [CONTRIBUTING.md](CONTRIBUTING.md) — правила внесения изменений;
- [SECURITY.md](SECURITY.md) — безопасность и ответственное тестирование;
- [CODEX.md](CODEX.md) — актуальные правила курса для автотестов;
- [REVIEW.md](REVIEW.md) — чек-лист ревью курса;
- [docs/README.md](docs/README.md) — карта инженерной документации;
- [requirements.md](requirements.md) — 50 функциональных требований MVP;
- [docs/coverage-matrix.md](docs/coverage-matrix.md) — requirement coverage и известные gaps/defects;
- [docs/test-strategy.md](docs/test-strategy.md) — стратегия тестирования;
- [docs/architecture.md](docs/architecture.md) — архитектура;
- [docs/quality-gates.md](docs/quality-gates.md) — обязательные проверки перед слиянием;
- [docs/ci-incident-runbook.md](docs/ci-incident-runbook.md) — порядок разбора сбоев CI;
- [docs/ai-review.md](docs/ai-review.md) — архитектура, безопасность, второй проход и Telegram-сигнал AI Review;
- [docs/interview-guide.md](docs/interview-guide.md) — подготовка к техническому собеседованию;
- [docs/registration-contract-smoke.md](docs/registration-contract-smoke.md) — ручная проверка контракта регистрации.

## Происхождение кода и вклад

Базовые учебные сценарии и постановка PomidorQA происходят из курса `lebed52/pomidorqa-course-tests`. В личном репозитории существенно расширены архитектура тестов, централизованный lifecycle `BrowserContext`, API Arrange/cleanup, многопользовательские и lifecycle-сценарии, cross-browser CI, security/accessibility/performance/visual workflows, отчётность и AI-review automation.

HW16 использует официальный `requirements.md` как источник спецификации. Аудит покрытия, дополнительные тесты, метрики и документация подготовлены с AI-assisted workflow; корректность не принимается «на доверии» и должна подтверждаться code review, `retries=0`, обязательными CI checks и ссылками из матрицы на реальные тесты.

## Цель проекта

Репозиторий показывает не количество тестов как самоцель, а управляемую систему качества: независимые уровни проверок, контролируемые тестовые данные, честный `retries=0`, диагностику, обязательные проверки перед слиянием, измеримое requirement coverage и отдельные сигналы для нефункциональных рисков.