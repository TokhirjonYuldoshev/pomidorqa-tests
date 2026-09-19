# PomidorQA — автоматизация тестирования

[![Playwright QA Automation CI](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/playwright.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/playwright.yml)
[![Security & Quality Gates](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/security.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/security.yml)
[![Nightly E2E Regression](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/nightly.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/nightly.yml)

Инженерный проект по автоматизации тестирования сервиса **PomidorQA** на **Playwright + TypeScript**. Основной фокус — качество тестового сигнала: проверяемые требования, изоляция данных, воспроизводимые ошибки, cross-browser регрессия, прозрачная диагностика и независимые quality gates.

## Ключевые результаты

Источник требований — [`requirements.md`](requirements.md). Полная связь «требование → статус → доказательство» находится в [`docs/coverage-matrix.md`](docs/coverage-matrix.md).

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

Автоматизированное покрытие требований и количество тестов — разные метрики. Все 50 требований имеют определённый статус, а 45 требований подтверждаются автоматизированными проверками на подходящем уровне.

Единственный известный продуктовый дефект в текущей матрице — **R8.3**: каталог учитывает совпадение в `want_to_learn`, хотя требование ограничивает поиск навыками `can_help`. Проверки написаны по требованию и намеренно используют `test.fail()`, поэтому дефект виден и не маскируется зелёным результатом.

## Измеренная скорость

Контрольный срез: `main` на commit `bf2d8d7`, Playwright QA Automation CI run **#296**, завершённый успешно с первого attempt. Ниже — фактическое время test jobs; это измеренный результат конкретного запуска, а не SLA.

| Уровень | Объём | Результат | Время |
| --- | ---: | ---: | ---: |
| Unit | 10 | 10 passed | **787 ms** |
| API | 11 | 11 passed | **3.6 s** |
| E2E / Chromium | 100 | 100 passed | **4.4 min** |
| E2E / Firefox | 100 | 100 passed | **5.4 min** |
| E2E / WebKit | 100 | 100 passed | **6.0 min** |

Browser matrix использует `workers=4` внутри каждого job, `retries=0` и `max-parallel: 2`. Актуальные длительности автоматически попадают в machine-readable reports и CI Dashboard, поэтому их можно сравнивать между запусками без ручного пересчёта.

## Инженерные находки

| Область | Уровень обнаружения | Статус | Что показал аудит |
| --- | --- | --- | --- |
| R5.5 — часовой пояс слотов | E2E / live UI | исправлено | время слота отображалось без корректного применения часового пояса владельца; после исправления поведение защищено `slot-timezone.spec.ts` |
| R11.2 — окно отмены | E2E / live UI | исправлено | отмена допускалась слишком близко к началу встречи; после исправления правило защищено `cancel-window.spec.ts` |
| R8.3 — фильтрация каталога | E2E / live UI | открытый дефект | поиск учитывает `want_to_learn`, хотя требование ограничивает фильтрацию `can_help`; проверки остаются `test.fail()` |
| Нагрузка live-стенда | CI / E2E infrastructure | mitigated | 12 одновременных E2E workers давали нестабильный 502-сигнал; matrix ограничена `max-parallel: 2`, максимум до 8 workers одновременно |

Эти находки разделяются по типу сигнала: продуктовые расхождения не смешиваются с ограничениями внешнего стенда или CI-инфраструктуры.

## Что покрывает система

| Область | Проверяемые риски |
| --- | --- |
| Авторизация и сессии | корректный вход, logout, защита страниц, сохранение сессии, независимость контекстов, смена пользователя |
| Профиль | обязательность имени, необязательные поля, часовой пояс, сохранение и изоляция данных |
| Навыки | `can_help` / `want_to_learn`, уникальность, удаление, независимость типов |
| Слоты | создание, сохранение, несколько дат/времён, удаление free-слота, защита booked-слота |
| Каталог | self-exclusion, фильтрация, граничные данные, изменение выдачи после изменения состояния |
| Бронирование | happy path, конкурентная гонка за один слот, согласованность сторон |
| Отмена | отмена гостем и хостом, повторное бронирование освобождённого слота, двухчасовое ограничение |
| Cross-browser | Chromium, Firefox, WebKit |
| Accessibility | axe-core / WCAG |
| Performance | Lighthouse |
| Visual | screenshot regression публичных страниц |
| Security | npm audit, dependency review, CycloneDX SBOM |

## Архитектура

```text
src/pyramid/              детерминированная логика и локальный mock API

tests/
├── unit/                 модульные проверки
├── api/                  HTTP-контракты
├── e2e/                  пользовательские сценарии
├── fixtures/             lifecycle BrowserContext
├── helpers/              тестовые данные и подготовка состояния
├── pages/                Page Objects
└── visual/               визуальные проверки

scripts/                  quality checks, метрики и CI-валидация
docs/                     инженерная документация
.github/workflows/         автоматизированные quality workflows
```

Разделение ответственности построено так:

**spec описывает сценарий и assertions → Page Object инкапсулирует действия экрана → helpers готовят данные и повторяемые операции → fixtures управляют BrowserContext и cleanup.**

Это уменьшает дублирование и удерживает бизнес-сценарий отдельно от технических деталей интерфейса.

## Стратегия тестирования

### Unit

Используются для чистой детерминированной логики без браузера и внешнего стенда.

### API

Используются для HTTP-контрактов, где UI не нужен для доказательства правила. Локальный mock API явно отделён от live API и не выдаётся за внутреннюю реализацию production-сервиса.

### E2E

Используются только для интегрированных пользовательских сценариев, где важны браузер, реальная сессия и состояние нескольких участников.

Основной E2E-набор выполняется в Chromium, Firefox и WebKit с `retries=0`. Внутри browser job используется `workers=4`, а matrix ограничена `max-parallel: 2`, чтобы не перегружать внешний стенд.

## Тестовые данные и изоляция

Каждый сценарий использует уникальные данные. Многопользовательские проверки работают в независимых `BrowserContext`.

Если UI-регистрация не является предметом проверки, аккаунт создаётся через тестовый API. Созданные тестовые аккаунты регистрируются для cleanup; teardown удаляет аккаунт и затем закрывает browser context.

Удаление аккаунта каскадно очищает связанные тестовые навыки, слоты и бронирования. Такой lifecycle уменьшает загрязнение общего стенда и делает результаты повторяемыми.

## Надёжность тестового сигнала

В проекте не используются как способ «сделать тест зелёным»:

- произвольные `waitForTimeout`;
- `force: true`;
- `.only`, `skip`, `page.pause()`;
- Playwright retries, скрывающие первый failure;
- случайный выбор элемента через `.first()` там, где нужна конкретная сущность.

Изменяющие состояние действия подтверждаются наблюдаемым причинным сигналом: HTTP-response, URL transition, изменением DOM/state или ограниченным polling там, где подтверждена eventual consistency.

Ключевые CI-инварианты проверяются машинно через `npm run ci:policy`: pinning GitHub Actions по полному SHA, `retries=0`, browser concurrency, локальный worker cap, trusted AI Review и отделение diagnostic transport от pass/fail.

## Наблюдаемость и диагностика

Каждый browser run формирует machine-readable JSON/JUnit, Playwright HTML и Allure. При failure сохраняются trace, screenshots, video и `test-results`.

`CI Summary` агрегирует:

- результаты Chromium / Firefox / WebKit;
- expected и unexpected failures;
- slowest scenarios;
- requirement coverage;
- номер GitHub attempt;
- ссылки на диагностические artifacts.

Доставка отчетов не определяет функциональный pass/fail. Сбой artifact storage остаётся отдельным reporting incident и не превращает успешные тесты в ложную продуктовую регрессию.

AI Review также отделён от функционального CI: он анализирует PR diff по локальным правилам проекта, показывает provenance reviewer-кода и policy fingerprint, умеет переходить в `degraded` mode при временной недоступности модели и отправляет результат отдельной Telegram job.

## Известные ограничения

| Requirement | Статус | Причина |
| --- | --- | --- |
| R7.1 | `out of scope` | доступный black-box интерфейс не раскрывает фактический `end_time` слота |
| R7.2 | `partial` | client-side запрет прошлого времени проверяем, прямой server-side обход UI недоступен |
| R7.5 | `partial` | отсутствие удаления booked-слота проверяем через UI, прямой server-side обход недоступен |
| R8.3 | `known defect` | фактическая фильтрация каталога расходится с требованием |
| R9.3 | `out of scope` | прошедший слот нельзя детерминированно создать через доступный интерфейс |

Ограничения не скрываются дополнительными retries или фиктивными assertions. Для каждого случая в coverage matrix указано, что именно доказано автоматизацией и что остаётся недоступным.

## Инженерная документация

- [requirements.md](requirements.md) — функциональная спецификация;
- [docs/coverage-matrix.md](docs/coverage-matrix.md) — traceability требований;
- [docs/test-coverage.md](docs/test-coverage.md) — карта test suites;
- [docs/test-strategy.md](docs/test-strategy.md) — стратегия тестирования;
- [docs/architecture.md](docs/architecture.md) — архитектура тестовой системы;
- [docs/quality-gates.md](docs/quality-gates.md) — quality gates и обязательные проверки;
- [docs/ci-incident-runbook.md](docs/ci-incident-runbook.md) — классификация и расследование CI incidents;
- [docs/ai-review.md](docs/ai-review.md) — архитектура AI Review;
- [docs/registration-contract-smoke.md](docs/registration-contract-smoke.md) — регистрационный contract smoke;
- [SECURITY.md](SECURITY.md) — безопасность и ответственное тестирование;
- [CONTRIBUTING.md](CONTRIBUTING.md) — правила внесения изменений;
- [CODEX.md](CODEX.md) — обязательные правила автотестов;
- [REVIEW.md](REVIEW.md) — чек-лист code review.

## Происхождение кода и вклад

Исходная база, от которой была начата работа над проектом: [lebed52/pomidorqa-course-tests](https://github.com/lebed52/pomidorqa-course-tests).

Текущий репозиторий существенно переработан и расширен: добавлены независимые Unit/API/E2E уровни, централизованный lifecycle `BrowserContext`, API-based Arrange/cleanup, многопользовательские и lifecycle-сценарии, cross-browser regression, requirement traceability, security/accessibility/performance/visual checks, machine-readable reporting, CI policy validation и AI-assisted review automation.

Дополнительные тесты, архитектура, CI, метрики и документация развивались итеративно с AI-assisted workflow. Результат не принимается «на доверии»: изменения подтверждаются code review, `retries=0`, автоматическими quality gates и связью требований с фактическими тестами.
