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

### Измеренное время последнего зелёного CI

Срез из PR #90 на текущем наборе тестов:

| Уровень / браузер | Результат | Время |
| --- | ---: | ---: |
| Unit | 10 passed | **1.3 s** |
| API | 11 passed | **5.1 s** |
| E2E / Chromium | 100 passed | **4.3 min** |
| E2E / Firefox | 100 passed | **6.4 min** |
| E2E / WebKit | 100 passed | **5.9 min** |

Три браузерных E2E jobs выполняются параллельно, поэтому их времена не суммируются в wall-clock CI. Значения выше — измерение конкретного зелёного запуска и могут меняться вместе со стендом, нагрузкой и составом набора.

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
| Отчёты | Playwright HTML, Allure, JSON/JUnit, trace, screenshots, video; Markdown-таблицы метрик в Actions Summary |
| Доступность | axe-core / WCAG |
| Производительность | Lighthouse |
| Визуальные проверки | сравнение скриншотов в Chromium |
| Безопасность | `npm audit`, проверка изменений зависимостей, CycloneDX SBOM |
| Стабильность | повторные прогоны с `retries=0` и отдельной таблицей метрик |
| Traceability | автоматическая проверка 50 requirement ID, статусов, test-ссылок и синхронизации README ↔ matrix |
| AI Review | отдельный Gemini-review после зелёного PR CI + ручной запуск для выбранного PR |
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

Quality job дополнительно запускает `npm run coverage:check`: скрипт проверяет наличие всех 50 requirement ID, допустимые статусы, существование test-файлов из матрицы и совпадение цифр `README.md` с `docs/coverage-matrix.md`. Поэтому процент покрытия нельзя случайно рассинхронизировать простой правкой документации.

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

Для браузерных E2E в CI используются `workers=4`, `retries=0` и `fail-fast: false`. Три браузера запускаются параллельно отдельными jobs, поэтому суммарный параллелизм остаётся высоким без избыточной нагрузки на один runner и live-стенд.

## Отдельные проверки качества

- **Accessibility Audit** — axe-core и WCAG;
- **Performance Smoke / Lighthouse** — производительность и технические показатели публичных страниц;
- **Visual Regression** — визуальные изменения login/register;
- **AI Review** — CODEX-scoped review после успешного PR CI; workflow использует доверенный код из `main`, умеет работать с draft PR и поддерживает ручной запуск по номеру PR;
- **Nightly E2E Regression** — плановая проверка внешнего стенда;
- **Stability Check** — повторные запуски без retries;
- **Registration Contract Smoke** — ручная проверка `POST /pomidorqa/auth/register → 303 → /pomidorqa`;
- **Telegram Notification Test** — ручная диагностика интеграции Telegram.

Эти сигналы отделены от функционального E2E, чтобы причина сбоя оставалась понятной.

## Отчёты и диагностика

Playwright формирует HTML, Allure, JSON и JUnit. При ошибках сохраняются trace, screenshots, video и `test-results`. В GitHub Actions отчёты разделены по браузерам и доступны как artifacts; сводка E2E-метрик публикуется в GitHub Actions Step Summary.

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
| `npm run verify:local` | быстрый локальный gate: Node 24 + ESLint + TypeScript + Unit + API |
| `npm run gate` | полный gate: runtime + lint + typecheck + Unit + API + E2E |
| `npm run regression:metrics` | полный Playwright-прогон и инженерная сводка метрик |
| `npm run metrics` | разобрать последний JSON-отчёт Playwright |
| `npm run coverage:check` | проверить 50/50 требований, статусы, test references и синхронизацию README ↔ matrix |
| `npm run lint` | статический анализ ESLint |
| `npm run typecheck` | проверка типов TypeScript |
| `npm run test:unit` | Unit |
| `npm run test:api` | API |
| `npm run test:e2e` | E2E в выбранном браузере |
| `npm run test:e2e:fast` | быстрый локальный E2E-прогон с 16 workers |
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
- [docs/interview-guide.md](docs/interview-guide.md) — подготовка к техническому собеседованию;
- [docs/registration-contract-smoke.md](docs/registration-contract-smoke.md) — ручная проверка контракта регистрации.

## Происхождение кода и вклад

Базовые учебные сценарии и постановка PomidorQA происходят из курса `lebed52/pomidorqa-course-tests`. В личном репозитории существенно расширены архитектура тестов, централизованный lifecycle `BrowserContext`, API Arrange/cleanup, многопользовательские и lifecycle-сценарии, cross-browser CI, security/accessibility/performance/visual workflows, отчётность и AI-review automation.

HW16 использует официальный `requirements.md` как источник спецификации. Аудит покрытия, дополнительные тесты, метрики и документация подготовлены с AI-assisted workflow; корректность не принимается «на доверии» и должна подтверждаться code review, `retries=0`, обязательными CI checks и ссылками из матрицы на реальные тесты.

## Цель проекта

Репозиторий показывает не количество тестов как самоцель, а управляемую систему качества: независимые уровни проверок, контролируемые тестовые данные, честный `retries=0`, диагностику, обязательные проверки перед слиянием, измеримое requirement coverage и отдельные сигналы для нефункциональных рисков.