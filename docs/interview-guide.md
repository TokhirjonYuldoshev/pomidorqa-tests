# QA Automation Interview Guide

Этот документ связывает архитектурные решения проекта с вопросами, которые могут возникнуть на техническом собеседовании. Ответы ниже описывают решения, которые действительно реализованы в репозитории.

Главное правило: сначала дать короткий ответ, затем раскрывать детали только если интервьюер спрашивает глубже.

## Почему Playwright?

### Короткий ответ

Я выбрал Playwright, потому что он поддерживает Chromium, Firefox и WebKit, имеет auto-waiting, browser contexts, trace/screenshot/video diagnostics, fixtures и удобную TypeScript/CI-интеграцию.

### Если попросят подробнее

Для проекта особенно важны:

- auto-waiting вместо ручных sleep;
- изолированные browser contexts;
- единый API для трёх браузерных движков;
- network/navigation signals;
- trace, screenshot и video для CI diagnostics;
- fixtures и projects в test runner.

Playwright выбран не просто потому, что он современный, а потому что его модель синхронизации и контекстов хорошо подходит для многопользовательских booking-сценариев.

## Почему Fixtures?

### Короткий ответ

Fixtures управляют lifecycle тестового окружения. Они централизованно создают и закрывают browser contexts, поэтому spec отвечает за бизнес-сценарий, а не за setup/teardown.

### Если попросят подробнее

В проекте есть role fixtures (`hostApp`, `guestApp`, `guest2App`) и `appFactory` для произвольного количества независимых пользователей.

Плюсы:

1. единое ownership ресурсов;
2. меньше дублирования;
3. централизованный cleanup;
4. меньше риска browser-context leaks.

## Почему retries отключены?

### Короткий ответ

Для E2E используется `retries=0`, потому что автоматический retry может скрыть нестабильность и превратить реальный первый failure в зелёный результат.

### Если попросят подробнее

Я не считаю retries плохими всегда, но в этом portfolio-проекте нужен честный сигнал.

- E2E: `retries=0`;
- Stability workflow: `repeat-each`, но тоже `retries=0`;
- Nightly: `retries=0`.

Если тест нестабилен, сначала исследую locator, test data, synchronization, shared state, external environment или eventual consistency.

## Как боролись с flaky tests?

### Короткий ответ

Не через `waitForTimeout`, `force` или скрытые retries. Используются наблюдаемые сигналы приложения, уникальные данные и изолированные browser contexts.

### Если попросят подробнее

В проекте применяются:

- уникальный `runId`;
- точные locators;
- browser-context isolation;
- ожидание конкретного mutation response;
- URL/UI state synchronization;
- централизованный teardown;
- `retries=0`;
- отдельные stability runs с repeat 5/10 и workers 1/2.

## Как устроен CI?

### Короткий ответ

CI разделён по слоям: Quality, Unit и API дают быстрый сигнал, E2E использует browser matrix Chromium/Firefox/WebKit, а результаты дополняются Allure/Playwright reporting, Security workflow, Nightly и Telegram notifications.

### Если попросят подробнее

Концептуальная схема:

```text
Pull Request / main
        |
        +--> Quality: ESLint + TypeScript
        +--> Unit tests
        +--> API tests
                 |
                 v
             E2E Matrix
        +--------+--------+
        |        |        |
    Chromium  Firefox   WebKit
        |        |        |
        +---- Reports ----+
                 |
        Summary + Telegram
```

Отдельными workflows работают:

- Security & Quality Gates;
- Nightly E2E Regression;
- Stability Check;
- Accessibility Audit;
- Performance Smoke / Lighthouse;
- Visual Regression;
- Telegram Notification Test.

## Почему POM?

### Короткий ответ

Page Object Model отделяет UI-детали от бизнес-сценария. Locators и UI actions находятся в Page Objects, а assertions бизнес-результата — в spec.

### Если попросят подробнее

Разделение ответственности:

- spec — бизнес-шаги и assertions;
- Page Object — locators, UI actions и техническая синхронизация;
- helper — domain preparation;
- fixture — lifecycle;
- test-data factory — уникальные данные.

## Как генерируются тестовые данные?

### Короткий ответ

Каждый сценарий получает уникальный `runId`. Связанные сущности используют один run id, но разные роли — host, guest, guest2.

### Если попросят подробнее

```text
runId = booking-flow-<unique>

host  + runId
guest + runId
guest2 + runId
skill + runId
```

Это предотвращает конфликты между CI-runs и упрощает расследование по логам.

## Для чего используется Allure?

### Короткий ответ

Для анализа результатов использую Allure Report. Он дополняет встроенный Playwright HTML report и используется для failure analysis.

### Если попросят подробнее

```text
Test Execution
      |
      v
Allure Results
      |
      v
Allure Report
      |
      v
GitHub Actions Artifact
```

Для каждого браузерного запуска можно сохранять отдельные artifacts, а trace/screenshots/video дают дополнительный технический контекст.

## Зачем Browser Matrix?

### Короткий ответ

Один и тот же E2E-suite поддерживает Chromium, Firefox и WebKit, чтобы выявлять browser-specific поведение, а не проверять только одну реализацию браузера.

### Если попросят подробнее

Browser выбирается через `E2E_BROWSER`. `fail-fast: false` позволяет получить сигнал по всем движкам, даже если один из них падает.

## Зачем Nightly Regression, если есть CI на PR?

### Короткий ответ

PR CI проверяет конкретное изменение перед merge. Nightly отвечает на другой вопрос: не появилась ли регрессия на live-стенде после merge или из-за внешних изменений.

### Если попросят подробнее

Nightly запускается по cron `0 23 * * *`: **23:00 UTC = 02:00 локального времени UTC+3 следующего дня**.

Используются:

- Chromium, Firefox, WebKit;
- 1 worker на браузер;
- `retries=0`;
- Allure и Playwright reports;
- failure diagnostics.

## Какие Security & Quality Gates есть в проекте?

### Короткий ответ

Есть отдельный security workflow: `npm audit`, dependency-change review и отдельный ESLint + TypeScript signal.

### Если попросят подробнее

При изменении `package.json` / `package-lock.json` выполняются `npm ci` и `npm audit --audit-level=high`. High/critical vulnerability делает security check красным.

Решение не зависит от GitHub Dependency Graph и переносимо между репозиториями.

## Зачем Accessibility Audit?

### Короткий ответ

Accessibility Audit нужен, чтобы автоматически находить WCAG/ARIA-проблемы, которые функциональные E2E-тесты обычно не замечают. В проекте используется axe-core в отдельном GitHub Actions workflow.

### Если попросят подробнее

`.github/workflows/accessibility.yml` использует pinned `axe-core@4.13.0` и Chromium.

Архитектурно важно, что accessibility — отдельный сигнал:

- результаты сохраняются artifact;
- обычный режим информационный;
- при ручном запуске можно включить `enforce=true`;
- serious/critical violations тогда становятся blocking failure.

Так можно сначала собрать baseline, устранить существующий долг, а уже потом вводить строгий gate.

## Зачем Lighthouse, если есть E2E?

### Короткий ответ

E2E проверяет бизнес-поведение, а Lighthouse измеряет другой класс качества: Performance, Accessibility, Best Practices и SEO. Поэтому это отдельный performance smoke, а не замена E2E.

### Если попросят подробнее

В проекте Lighthouse запускается для catalog, login и register через pinned `lighthouse@13.4.1`.

Результат публикуется таблицей и сохраняется JSON artifact. Budgets по умолчанию информационные, а в ручном режиме можно включить enforcement.

Последний подтверждённый прогон:

| Page | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| catalog | 95 | 96 | 77 | 100 |
| login | 97 | 96 | 77 | 90 |
| register | 97 | 92 | 77 | 90 |

Я бы объяснил это так: performance smoke показывает тренд и быстрые технические риски, но на shared live-стенде не стоит бездумно превращать каждый показатель в жёсткий release gate.

## Зачем Visual Regression?

### Короткий ответ

Visual Regression ловит изменения внешнего вида, которые могут не нарушить DOM/assertions функционального теста. Например, элемент существует и кликается, но визуально уехал или перекрылся.

### Если попросят подробнее

В проекте есть отдельный Playwright visual config:

- Chromium;
- login/register;
- screenshot baseline;
- baseline cache ключуется по версии Playwright;
- `maxDiffPixelRatio = 0.01`;
- snapshots и failure diff сохраняются artifacts.

Первый run без совместимого baseline его создаёт, последующие сравнивают текущий UI с baseline.

## Зачем отдельный Telegram Notification Test?

### Короткий ответ

Основной CI отправляет Telegram notification, а отдельный diagnostic workflow нужен, чтобы быстро понять, где именно сломалась интеграция: secrets, bot token, chat ID или `sendMessage`.

### Если попросят подробнее

Проверка идёт по этапам:

```text
Repository secrets
      |
      v
getMe
      |
      v
getChat
      |
      v
sendMessage
```

Так диагностика не зависит от полного E2E-run. Значения `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` в лог не выводятся.

## Почему один worker в E2E?

### Короткий ответ

E2E работают с общим live-стендом, поэтому один worker на браузер уменьшает инфраструктурный шум и делает failure signal более детерминированным.

Параллельное поведение отдельно исследуется в Stability workflow с workers 1 и 2.

## Почему нельзя просто использовать `.first()`?

### Короткий ответ

`.first()` опасен, если нужно найти конкретную бизнес-сущность: тест может выбрать не того пользователя, слот или карточку и дать ложный результат.

Поэтому используются уникальные данные и точная идентификация. Если сценарий ожидает единственный слот, Page Object сначала проверяет precondition «слот действительно один».

## Unit, API и E2E — зачем все три уровня?

### Короткий ответ

Они дают разные сигналы. Unit быстро проверяют чистую логику, API — HTTP-поведение без UI, E2E — реальный пользовательский flow.

Non-functional workflows затем добавляют ещё три независимых измерения: accessibility, performance и visual integrity.

## Как бы вы расследовали красный E2E в CI?

### Короткий ответ

Сначала определил бы масштаб: один браузер или все. Затем посмотрел бы assertion/error, Allure/Playwright report, trace, screenshot/video и network context.

После этого разделил бы причины на:

- product defect;
- test-data problem;
- locator/synchronization issue;
- browser-specific behavior;
- external/live-stand instability.

Retry не использовал бы как первое «исправление».

## Как рассказать о non-functional QA в одном ответе?

### Короткий ответ

Помимо Unit/API/E2E я добавил отдельные проверки accessibility, performance и visual regression. Они специально вынесены в независимые workflows, потому что отвечают на разные вопросы качества и создают разные artifacts.

### Если попросят подробнее

- axe-core — WCAG violations;
- Lighthouse — Performance / Accessibility / Best Practices / SEO;
- Playwright screenshots — visual diff;
- Telegram diagnostic workflow — observability самой CI-интеграции.

Это показывает, что тестовая стратегия не ограничивается только функциональным happy path.

## Как коротко рассказать об этом проекте

Пример ответа примерно на 45–60 секунд:

> Это standalone QA Automation-проект на Playwright и TypeScript. В нём есть Unit, API и E2E уровни, Page Objects, fixtures, helpers и генерация уникальных тестовых данных. E2E поддерживает Chromium, Firefox и WebKit, работает без retries и сохраняет Playwright/Allure diagnostics. Отдельно я настроил nightly regression, stability workflow, security gates, accessibility audit через axe-core, Lighthouse performance smoke и visual regression по screenshot baseline. Для CI-уведомлений используется Telegram Bot API, а отдельный diagnostic workflow проверяет token, chat и реальную отправку сообщения. Основной акцент проекта — не количество тестов, а разделение типов тестового сигнала и возможность быстро понять причину failure.

Не нужно заучивать формулировку дословно. Важно понимать, зачем существует каждый слой и какую проблему он решает.