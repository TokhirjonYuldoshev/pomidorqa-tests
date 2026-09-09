# PomidorQA QA Automation Architecture

Этот документ фиксирует архитектурные решения standalone QA Automation-проекта и объясняет, почему тестовая инфраструктура устроена именно так.

## Цели

Архитектура должна обеспечивать:

1. независимость E2E-сценариев;
2. однозначные locators и test data;
3. отсутствие скрытых sleep/retry workaround;
4. централизованный browser-context lifecycle;
5. разделение scenario, actions, assertions и setup;
6. воспроизводимую диагностику CI failures;
7. возможность отдельно stress-тестировать flaky-поведение.

## Architecture at a glance

```text
Tests
 |
 ├── E2E scenarios
 |
 ├── Page Objects
 |
 ├── Fixtures
 |
 ├── Helpers
 |
 └── Test Data Factories
```

E2E-сценарии описывают бизнес-поведение и assertions. Page Objects инкапсулируют взаимодействие с UI, fixtures управляют browser contexts, helpers отвечают за повторяемую подготовку, а test-data factories создают независимые уникальные данные для каждого запуска.

## Слои

```mermaid
flowchart TB
    SPEC[E2E spec] --> FIX[Fixtures]
    SPEC --> HELP[Helpers / factories]
    SPEC --> ASSERT[Playwright expect]
    FIX --> APP[AppContext]
    APP --> POM[Page Objects]
    HELP --> DATA[Test data factory]
    HELP --> SETUP[Domain setup]
    POM --> UI[PomidorQA UI]
    SETUP --> UI
    FIX --> CLEAN[Context teardown]
```

### `tests/e2e`

Отвечает за бизнес-сценарий:

- шаги пользователя;
- `test.step`;
- assertions;
- выбор того, какие fixtures/helpers нужны сценарию.

Spec не должен владеть ручным lifecycle browser context и не должен дублировать повторяемый setup.

### `tests/pages`

Page Objects инкапсулируют:

- locators;
- UI actions;
- синхронизацию действия с наблюдаемым UI/network signal.

Assertions бизнес-результата остаются в spec. Page Object может валидировать технический precondition действия, если без него действие становится неоднозначным. Например, booking flow, который создаёт ровно один слот, проверяет, что доступен действительно один день и один slot button.

### `tests/fixtures`

`app-fixtures.ts` владеет lifecycle browser contexts.

`appFactory` создаёт произвольное количество независимых `AppContext` внутри теста. Role fixtures (`hostApp`, `guestApp`, `guest2App`) дают читаемый интерфейс booking-сценариям.

Все созданные через factory contexts регистрируются для teardown.

### `tests/helpers`

Helpers разделены по ответственности:

- `routes.ts` — маршруты PomidorQA;
- `test-data.ts` — уникальные tokens/run ids;
- `user.ts` — `TestUser`, создание пользователя, регистрация;
- `booking.ts` — `AppContext`, создание и закрытие app contexts;
- `catalog.ts` — domain setup каталога.

Маршруты не принадлежат user-helper, а генерация уникальных данных не принадлежит catalog-helper. Это уменьшает скрытую связанность между слоями.

## Test data

Каждый сценарий получает уникальный `runId`.

Связанные сущности одного сценария используют общий run id:

```text
booking-flow-<unique>
host + runId
guest + runId
guest2 + runId
skill + runId
```

Плюсы:

- данные не конфликтуют между параллельными/повторными запусками;
- связанные сущности легко сопоставить в логах;
- имя пользователя не получает несколько вложенных случайных suffix;
- сценарий остаётся читаемым.

## Browser context lifecycle

`createApp()` создаёт `BrowserContext`, затем `Page` и Page Objects.

Если setup падает после создания context, context закрывается до повторного выброса исходной ошибки.

При teardown `closeApps()` пытается закрыть все зарегистрированные contexts. Cleanup failure не превращается в тихий `console.warn`: ошибка должна быть видимой, потому что утечка context — инфраструктурная проблема теста.

## Синхронизация

Запрещённые способы стабилизации:

- `waitForTimeout`;
- `force: true`;
- `.only`;
- `skip`;
- `page.pause()`;
- CI retries для превращения красного E2E в зелёный.

Используемые сигналы:

- URL transition;
- HTTP response конкретного mutation request;
- появление/исчезновение конкретного элемента;
- Playwright auto-waiting;
- polling/reload только для подтверждённой eventual consistency.

## Booking slot semantics

Booking tests сами создают единственный future slot для уникального host.

Поэтому действие называется `pickOnlyAvailableSlot()`, а не `pickFirstSlot()`.

Перед выбором Page Object проверяет:

1. доступен ровно один день со слотами;
2. после выбора дня доступен ровно один slot button.

Если приложение показывает другое состояние, тест падает с диагностикой вместо выбора произвольного `.first()`.

## CI

Основной pipeline:

```mermaid
flowchart LR
    PR[PR / main] --> Q[Quality]
    PR --> U[Unit]
    PR --> A[API]
    Q --> E[E2E Matrix]
    U --> E
    A --> E
    E --> C[Chromium]
    E --> F[Firefox]
    E --> W[WebKit]
    C --> REPORT[Playwright HTML + Allure]
    F --> REPORT
    W --> REPORT
    E --> SUMMARY[CI summary]
    E --> TG[Telegram result]
```

Каждый browser job выполняется с:

```text
workers=1
retries=0
```

Один worker на браузер выбран из-за общего live-стенда. Ноль retries нужен, чтобы первый реальный failure оставался красным сигналом.

## Browser Matrix Testing

```text
E2E Matrix

├── Chromium
├── Firefox
└── WebKit
```

Один и тот же E2E-suite выполняется в трёх движках Playwright. Browser выбирается через `E2E_BROWSER`, а GitHub Actions matrix создаёт отдельный job для Chromium, Firefox и WebKit.

`fail-fast: false` позволяет завершить все три browser jobs даже если один из них падает. Это сохраняет полный cross-browser сигнал за один CI run вместо остановки матрицы после первого failure.

Allure и Playwright HTML artifacts получают имя браузера, поэтому результаты каждого движка можно анализировать отдельно.

## Allure Reporting

```text
Test Execution

        |
        v

Allure Results

        |
        v

Allure Report
```

Во время E2E-запуска Allure reporter сохраняет сырые результаты в `allure-results/`. После завершения тестов CI генерирует статический отчёт `allure-report/` и загружает его как GitHub Actions artifact.

Отчёт генерируется и при failed E2E run, если workflow не был отменён. При падении тестов в GitHub Actions Summary появляется отдельная ссылка на Allure artifact для анализа причины failure.

Playwright HTML report сохраняется параллельно как встроенный быстрый отчёт, а Allure используется как дополнительный слой анализа результатов и истории выполнения.

## Nightly Regression

`.github/workflows/nightly.yml` отделяет плановую регрессию от required PR gate.

Workflow запускается:

- автоматически каждый день по cron `0 2 * * *` — **02:00 UTC**;
- вручную через `workflow_dispatch`.

Каждый nightly run выполняет полный E2E-suite в Chromium, Firefox и WebKit. Для каждого браузера используются `workers=1` и `retries=0`, а Allure/Playwright HTML artifacts сохраняются отдельно.

Nightly не заменяет PR CI: pull request должен пройти обычные Quality, Unit, API и E2E matrix checks до merge. Плановый запуск нужен для обнаружения регрессий или изменений live-стенда, которые появились уже после merge.

## Security & Quality Gates

`.github/workflows/security.yml` добавляет независимый security pipeline поверх основного тестового CI.

Gates:

- `npm audit --audit-level=high` — блокирует high/critical vulnerabilities в npm dependency tree;
- dependency change review — сравнивает `package.json` и `package-lock.json` между base/head pull request и при изменениях выполняет `npm ci` + `npm audit --audit-level=high`;
- ESLint + TypeScript — подтверждает code-quality signal отдельно от security checks.

Dependency change review запускается только для pull requests. Если dependency manifests не изменялись, job явно фиксирует это и завершается без лишней установки зависимостей. Если изменялись, проверяются lockfile consistency и high/critical vulnerabilities.

Такой gate не зависит от repository-level GitHub Dependency Graph и поэтому остаётся переносимым между репозиториями. `npm audit` и code quality запускаются также после push в `main` и вручную.

Security workflow не заменяет Unit/API/E2E проверки: он отвечает за другой класс риска и формирует отдельный GitHub Actions Summary.

## Stability workflow

Отдельный workflow не является required gate. Его задача — исследование стабильности.

Поддерживаются:

- `repeat-each=5/10`;
- workers `1/2`;
- `retries=0`;
- booking-flow или весь E2E suite;
- HTML report и failure diagnostics.

Перед включением strict CI gate была подтверждена матрица:

| Target | Repeats | Workers | Result |
| --- | ---: | ---: | --- |
| booking-flow | 10 | 1 | passed |
| booking-flow | 10 | 2 | passed |
| all E2E | 5 | 1 | passed |
| all E2E | 5 | 2 | passed |

GitHub Actions run: `34267366176`.

## Review policy

При code review приоритеты такие:

1. BLOCKER — тест не проверяет требование, ломает suite или создаёт опасную ложную зелень;
2. MAJOR — нестабильная/неоднозначная идентификация сущности, leak, зависимость между тестами, скрытый retry/sleep;
3. MINOR — архитектурный долг, который не ломает сигнал сейчас;
4. NIT — косметика без влияния на корректность.

Главная цель review — качество тестового сигнала, а не количество комментариев.
