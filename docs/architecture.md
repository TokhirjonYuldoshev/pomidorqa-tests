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
7. возможность отдельно stress-тестировать flaky-поведение;
8. отдельные non-functional сигналы для accessibility, performance и visual regression;
9. узкие manual-only diagnostics для проверки отдельных интеграций и HTTP-контрактов без расширения required PR gate.

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

Quality workflows
 |
 ├── Accessibility Audit
 ├── Performance Smoke / Lighthouse
 └── Visual Regression

Operational diagnostics
 |
 ├── Telegram Notification Test
 └── Registration Contract Smoke
```

E2E-сценарии описывают бизнес-поведение и assertions. Page Objects инкапсулируют взаимодействие с UI, fixtures управляют browser contexts, helpers отвечают за повторяемую подготовку, а test-data factories создают независимые уникальные данные для каждого запуска. Non-functional workflows вынесены отдельно, чтобы не смешивать функциональный E2E-сигнал с accessibility, performance и visual checks. Узкие manual-only diagnostics отдельно проверяют CI-интеграции и сетевой контракт регистрации.

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

Для регистрации helper ждёт точный `POST /pomidorqa/auth/register`, проверяет HTTP status mutation response и только затем валидирует redirect. Это отделяет реальную registration mutation от других POST-запросов страницы.

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

Allure является обычной зависимостью проекта: `allure-playwright` и Allure 3 CLI зафиксированы в `devDependencies` и устанавливаются обычным `npm ci`.

```text
Test Execution
      |
      +--> Playwright HTML
      |
      v
Allure Results
      |
      v
Allure Report
```

Reporter включён в Playwright config и пишет `allure-results/` как локально, так и в CI для Unit, API и E2E запусков. Локально статический отчёт собирается через `npm run allure:generate` и открывается через `npm run allure:open`.

В GitHub Actions основной E2E CI, Nightly и Stability используют те же lockfile-зависимости, генерируют `allure-report/` и сохраняют его как artifact. Для browser matrix отчёты разделены по движкам.

Отчёт генерируется и при failed E2E run, если workflow не был отменён. При падении тестов GitHub Actions Summary даёт ссылку на artifacts для анализа причины failure. Trace/screenshots/video дополняют Allure и Playwright HTML техническим контекстом.

## Non-functional QA workflows

Функциональный E2E-suite дополнен независимыми workflow для других классов качества. Они намеренно не смешаны с бизнес-E2E: каждый даёт отдельный сигнал и отдельные artifacts.

### Accessibility Audit

`.github/workflows/accessibility.yml` запускает WCAG-аудит через `axe-core@4.13.0` в Chromium.

- используется отдельный `scripts/accessibility-audit.mjs`;
- отчёты сохраняются в `.qa-artifacts/accessibility/` и загружаются как GitHub Actions artifact на 14 дней;
- обычный режим информационный;
- при ручном `workflow_dispatch` можно включить `enforce=true`, тогда serious/critical нарушения делают workflow красным;
- workflow также имеет отдельный weekly schedule.

Такой режим позволяет сначала собирать accessibility baseline и анализировать реальные нарушения, а затем при необходимости превратить выбранный порог в gate.

### Performance Smoke / Lighthouse

`.github/workflows/performance.yml` выполняет desktop Lighthouse smoke для трёх публичных страниц:

- catalog — `/pomidorqa`;
- login — `/pomidorqa/auth/login`;
- register — `/pomidorqa/auth/register`.

Проверяются категории `performance`, `accessibility`, `best-practices` и `seo` через pinned `lighthouse@13.4.1`. JSON-отчёты сохраняются в `.qa-artifacts/lighthouse/` и публикуются artifact на 14 дней.

Budget findings по умолчанию информационные. При ручном запуске можно включить enforcement и использовать те же budgets как blocking signal.

### Visual Regression

`.github/workflows/visual.yml` использует отдельный `playwright.visual.config.ts` и `tests/visual/public-pages.visual.spec.ts`.

Текущая стратегия:

- Chromium;
- страницы login и register;
- baseline хранится в GitHub Actions cache и ключуется по версии Playwright;
- если совместимого baseline ещё нет, первый run создаёт его;
- следующие runs сравнивают текущие screenshots с baseline;
- `maxDiffPixelRatio = 0.01`;
- snapshots сохраняются как artifact на 30 дней, а failure diagnostics — отдельно.

Visual workflow изолирован от функциональных E2E-тестов, чтобы screenshot diff не смешивался с проверкой бизнес-логики.

## Operational diagnostics

### Telegram diagnostics

Основной CI отправляет итог через Telegram Bot API. Для диагностики интеграции существует отдельный ручной `.github/workflows/telegram-test.yml`.

Он проверяет интеграцию по цепочке:

```text
Repository secrets
      |
      v
getMe — bot token
      |
      v
getChat — target chat
      |
      v
sendMessage — real diagnostic message
```

Workflow не выводит значения secrets в лог и даёт точную причину failure: отсутствующий secret, невалидный bot token, недоступный chat ID или ошибка `sendMessage`.

### Registration Contract Smoke

`.github/workflows/registration-contract-smoke.yml` — manual-only проверка реального HTTP-контракта регистрации.

```text
GET /pomidorqa/auth/register
          |
          v
POST /pomidorqa/auth/register
          |
          v
HTTP 303
          |
          v
/pomidorqa
```

Проверка использует Chromium и уникального пользователя, фильтрует точный method + pathname, проверяет `303` и финальный redirect. Результат сохраняется в `.qa-artifacts/registration-contract/summary.json` и публикуется artifact на 14 дней.

Workflow намеренно не запускается на PR, push или cron: каждый запуск создаёт пользователя на live-стенде и нужен как узкая диагностика контракта, а не как required gate. Подробности находятся в `docs/registration-contract-smoke.md`.

## Nightly Regression

`.github/workflows/nightly.yml` отделяет плановую регрессию от required PR gate.

Workflow запускается:

- автоматически каждый день по cron `0 23 * * *` — **23:00 UTC, что соответствует 02:00 локального времени UTC+3 следующего дня**;
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
- Playwright HTML и Allure Report artifacts;
- failure diagnostics.

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
