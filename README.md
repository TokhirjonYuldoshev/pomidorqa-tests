# PomidorQA — test automation

[![Playwright QA Automation CI](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/playwright.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/playwright.yml)
[![Nightly E2E Regression](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/nightly.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/nightly.yml)
[![Security & Quality Gates](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/security.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/security.yml)
[![Stability Check](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/stability.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/stability.yml)
[![Accessibility Audit](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/accessibility.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/accessibility.yml)
[![Performance Smoke / Lighthouse](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/performance.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/performance.yml)
[![Visual Regression](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/visual.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/visual.yml)

Автоматизация тестирования сервиса PomidorQA на **Playwright + TypeScript** с раздельными Unit, API и E2E-уровнями, cross-browser regression, контролем тестовых данных, security/accessibility/performance/visual-сигналами и воспроизводимой CI-диагностикой.

Проект построен вокруг продуктовых рисков, а не количества тестов. Основные зоны риска: авторизация и изоляция сессий, согласованность профиля, управление свободными слотами, фильтрация каталога, гонка за один слот, отмена бронирования и корректность временных ограничений.

## Текущие метрики

Источник требований — [`requirements.md`](requirements.md). Связь «требование → статус → доказательство» ведётся в [`docs/coverage-matrix.md`](docs/coverage-matrix.md).

| Метрика | Значение |
| --- | ---: |
| Требований MVP | 50 |
| Полнота аудита требований | **50 / 50 (100%)** |
| `automated` | **45 / 50 (90%)** |
| `partial` | 2 / 50 (4%) |
| `known defect` | 1 / 50 (2%) |
| `out of scope` | 2 / 50 (4%) |
| Unit | 10 |
| API | 11 |
| E2E | 100 |
| Всего автоматизированных проверок | **121** |

Все 50 требований классифицированы. Процент automated не смешивается с полнотой аудита: требование может быть частично наблюдаемым, недостижимым через доступные black-box интерфейсы или иметь подтверждённое расхождение продукта.

Известное расхождение **R8.3** оставлено видимым: каталог учитывает `want_to_learn`, хотя спецификация ограничивает поиск навыками `can_help`. Проверки написаны по требованию и используют `test.fail()`, поэтому дефект не превращён в «зелёное» ожидаемое поведение.

## Покрываемые пользовательские потоки

### Авторизация и сессии

Проверяются успешный и ошибочный вход, восстановление после неверного пароля, сохранение сессии после reload, logout, защита приватных страниц, независимость браузерных контекстов, согласованность нескольких вкладок и отсутствие влияния одной пользовательской сессии на другую.

### Профиль и навыки

Проверяются обязательность имени, необязательные Telegram и описание, часовой пояс, оба типа навыков, уникальность навыков одного типа, сохранение после reload, удаление, независимость полей и изоляция данных разных аккаунтов.

### Свободные слоты

Проверяются создание и удаление слотов, несколько времён и дат, защита от прошлой даты, отображение времени, изоляция слотов разных пользователей и изменение состояния после бронирования.

### Каталог

Покрыты self-exclusion, условия появления участника в каталоге, точное и частичное совпадение, регистр, пробелы, Enter, кириллица, специальные символы, одинаковые имена и навыки, обновление выдачи после изменения профиля, слотов, бронирований и удаления аккаунта.

### Бронирование и отмена

Проверяются основной путь, гонка двух пользователей за один слот, единственность подтверждённой брони, видимость встречи у обеих сторон, отмена каждой стороной, двухчасовое окно отмены, восстановление свободного слота и повторное бронирование другим пользователем.

## Архитектура тестов

```text
src/pyramid/              детерминированная бизнес-логика и локальный mock API

tests/
├── unit/                 Unit-проверки
├── api/                  HTTP-контракты
├── e2e/                  интегрированные пользовательские сценарии
├── fixtures/             lifecycle BrowserContext и teardown
├── helpers/              подготовка состояния и тестовые данные
├── pages/                Page Objects
└── visual/               визуальные проверки

scripts/                  метрики, policy checks, dashboards, AI review
docs/                     архитектура, стратегия, coverage и runbooks
.github/workflows/         CI и специализированные quality workflows
```

Разделение ответственности:

**spec описывает сценарий и assertions → Page Object инкапсулирует действия экрана → helpers готовят повторяемое состояние → fixtures владеют BrowserContext и cleanup**.

Это уменьшает дублирование, ограничивает связанность между тестами и делает источник сбоя понятнее.

## Работа с тестовыми данными

Каждый сценарий использует уникальные данные. Многопользовательские проверки выполняются в отдельных `BrowserContext`.

Если UI-регистрация не является предметом проверки, аккаунт создаётся через тестовый API. Созданные аккаунты регистрируются для teardown; cleanup удаляет аккаунт до закрытия контекста. Это уменьшает нагрузку на общий стенд и снижает накопление тестовых сущностей.

Готовые постоянные аккаунты не являются зависимостью E2E-набора.

## Синхронизация и детерминизм

Как способ «починить» тест не используются:

- `waitForTimeout` и произвольные паузы;
- `force: true`;
- `.only`;
- `page.pause()`;
- положительные Playwright retries.

Основные E2E, Nightly и Stability сохраняют **`retries=0`**.

Изменяющее состояние действие подтверждается наблюдаемым сигналом: ожидаемым HTTP-ответом, URL-переходом, изменением UI-состояния или ограниченным polling только там, где подтверждена eventual consistency.

Browser matrix использует **Chromium + Firefox + WebKit**, `workers=4` на browser job и `max-parallel: 2`. Локальный `test:e2e:fast` также ограничен четырьмя workers и `retries=0`.

## Система quality signals

Проект разделяет первичный результат проверки и вспомогательную доставку диагностики.

| Сигнал | Назначение |
| --- | --- |
| Quality | ESLint, TypeScript, coverage integrity, AI-review self-check, CI policy |
| Unit | детерминированная логика |
| API | HTTP-контракты и live registration contract |
| E2E | пользовательские сценарии в Chromium, Firefox и WebKit |
| Regression Gate | агрегированный функциональный итог |
| Security | npm audit, dependency consistency, static checks, SBOM |
| Accessibility | axe-core / WCAG |
| Performance | Lighthouse |
| Visual | screenshot comparison |
| Nightly | плановая cross-browser регрессия |
| Stability | повторные прогоны выбранного сценария при `retries=0` |
| AI Review | CODEX-scoped review PR diff с trusted-main reviewer |
| Telegram | доставка уже вычисленного результата |

`npm run ci:policy` машинно защищает ключевые CI-инварианты: pinning GitHub Actions на полный SHA, отсутствие `pull_request_target`, `retries=0`, browser concurrency, local worker cap, trusted-main AI Review и non-blocking diagnostic uploads.

## Отчёты и диагностика

Playwright публикует HTML, JSON/JUnit и Allure-данные. При E2E failure сохраняются trace, screenshot, video и `test-results`.

Diagnostic artifact transport не является источником результата тестов. Если upload отчёта временно недоступен, это остаётся отдельной reporting-проблемой и не должно превращать успешно завершившуюся проверку в ложный продуктовый failure.

`CI Summary` агрегирует machine-readable browser reports и показывает:

- статус основных gates;
- номер GitHub run attempt;
- requirement coverage;
- test inventory;
- browser matrix;
- expected/unexpected failures;
- retries/flaky counters;
- slowest scenarios;
- состояние test-data discipline;
- ссылки на artifacts.

Подробный порядок расследования находится в [`docs/ci-incident-runbook.md`](docs/ci-incident-runbook.md).

## AI Review

AI Review запускается после успешного PR CI и использует reviewer-код из доверенной ветки `main`. PR-код не checkout-ится и не исполняется привилегированным workflow.

Проверка состоит из:

1. deterministic preflight по однозначным правилам `CODEX.md`;
2. requirement traceability через coverage matrix;
3. модельного анализа diff;
4. отдельного validation pass для отсечения неподтверждённых замечаний;
5. публикации provenance: reviewed commit, upstream CI, reviewer revision и policy fingerprint.

При временной недоступности модели workflow переходит в `degraded` mode: deterministic findings сохраняются, а непроверенные модельные выводы не публикуются как подтверждённые.

## Структура инженерной документации

| Документ | Назначение |
| --- | --- |
| [`requirements.md`](requirements.md) | спецификация продукта |
| [`docs/coverage-matrix.md`](docs/coverage-matrix.md) | requirement coverage |
| [`docs/test-coverage.md`](docs/test-coverage.md) | карта suites и рисков |
| [`docs/test-strategy.md`](docs/test-strategy.md) | risk-based стратегия |
| [`docs/architecture.md`](docs/architecture.md) | устройство тестовой системы |
| [`docs/quality-gates.md`](docs/quality-gates.md) | обязательные и диагностические сигналы |
| [`docs/ci-incident-runbook.md`](docs/ci-incident-runbook.md) | классификация CI incidents |
| [`docs/ai-review.md`](docs/ai-review.md) | архитектура AI Review |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | правила изменений |
| [`CODEX.md`](CODEX.md) | обязательные правила тестового кода |
| [`REVIEW.md`](REVIEW.md) | checklist ревью |

## Основные команды

| Команда | Назначение |
| --- | --- |
| `npm run verify:local` | runtime + lint + typecheck + coverage + CI policy + Unit + API |
| `npm run gate` | локальный полный gate с E2E |
| `npm run coverage:check` | проверить 50 requirement ID, статусы и evidence |
| `npm run ci:policy` | проверить CI-инварианты и local E2E worker cap |
| `npm run test:unit` | Unit |
| `npm run test:api` | API |
| `npm run test:e2e` | E2E в выбранном браузере |
| `npm run test:e2e:fast` | E2E с 4 workers и `retries=0` |
| `npm run metrics` | разобрать последний JSON report |
| `npm run report` | открыть Playwright HTML report |
| `npm run allure:generate` | собрать Allure report |

Для другого браузера используется переменная окружения `E2E_BROWSER`:

```bash
E2E_BROWSER=firefox npm run test:e2e
E2E_BROWSER=webkit npm run test:e2e
```

## Текущее состояние

- Requirement audit: **50 / 50**.
- Automated requirement coverage: **45 / 50 (90%)**.
- Test inventory: **121**.
- Cross-browser E2E: Chromium, Firefox, WebKit.
- Playwright retries: **0**.
- Known product discrepancy: **R8.3**.
- Coverage и CI policy проверяются автоматически.
- Test/report/notification signals разделены по ответственности.

Проект сознательно не заявляет 100% automated coverage там, где black-box интерфейс не позволяет доказать скрытую server-side часть требования. Статусы `partial`, `known defect` и `out of scope` сохраняют границы доказательства видимыми.

## Происхождение кода и вклад

Первоначальная база проекта: [lebed52/pomidorqa-course-tests](https://github.com/lebed52/pomidorqa-course-tests).

Текущий репозиторий существенно расширен: переработана архитектура тестов, добавлены независимый lifecycle `BrowserContext`, API Arrange/cleanup, многопользовательские и lifecycle-сценарии, cross-browser regression, requirement traceability, quality/security/accessibility/performance/visual workflows, отчётность, CI policy и AI Review.
