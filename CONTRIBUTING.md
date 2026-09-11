# Contributing

Этот репозиторий — standalone portfolio-проект по QA Automation на Playwright + TypeScript. Он вырос из учебного PomidorQA-проекта, но развивается как самостоятельная тестовая инфраструктура.

## Рабочий процесс

Изменения в `main` вносятся через отдельные ветки и Pull Request.

Рекомендуемые префиксы веток:

- `feature/` — новая функциональность;
- `fix/` — исправление дефекта;
- `refactor/` — изменение структуры без смены поведения;
- `test/` — новые или переработанные автотесты;
- `docs/` — документация;
- `chore/` — инфраструктурные и служебные изменения.

## Перед началом работы

Проект и GitHub Actions стандартизированы на **Node.js 24**. `.nvmrc` фиксирует ту же major-версию для инструментов, которые поддерживают этот файл.

```bash
git checkout main
git pull --ff-only origin main
nvm use 24
npm ci
```

На Windows с nvm-windows используйте явное `nvm use 24`; на Unix-like окружениях обычный nvm также может прочитать `.nvmrc`. Если nvm не используется, убедитесь, что `node --version` показывает Node 24. `npm run verify:local` проверяет runtime первым шагом и fail-fast завершится на другой major-версии, чтобы локальный результат не расходился с CI baseline.

Для локального E2E при необходимости установите Chromium:

```bash
npx playwright install chromium
```

Для локальной cross-browser проверки можно установить все три движка:

```bash
npx playwright install chromium firefox webkit
```

## Quality gates

Быстрый детерминированный preflight перед PR не зависит от live-стенда и запускает Node runtime check, lint, typecheck, Unit и API:

```bash
npm run verify:local
```

Live E2E остаётся отдельным сигналом и запускается осознанно:

```bash
npm run test:e2e
```

При необходимости те же локальные проверки можно запускать по отдельности:

```bash
npm run runtime:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:api
```

Полный Playwright-запуск:

```bash
npm test
```

Playwright формирует HTML report и `allure-results/`. При необходимости локальный Allure Report собирается командами:

```bash
npm run allure:generate
npm run allure:open
```

E2E используют общий live-стенд `https://aiqa.su`, поэтому инфраструктурный сбой стенда нужно отличать от регрессии в тестовом коде. Не маскируйте нестабильность через `waitForTimeout`, `force: true`, дополнительные retries или чрезмерные таймауты.

## Правила для E2E

- сценарий и assertions остаются в `tests/e2e`;
- повторяемые действия и данные выносятся в `tests/helpers`;
- локаторы и действия экранов живут в `tests/pages`;
- используйте уникальные тестовые данные;
- browser contexts должны иметь явного владельца lifecycle и гарантированный teardown;
- предпочитайте `getByRole`, `getByLabel`, `getByTestId`;
- не используйте `.first()` для выбора конкретной бизнес-сущности, если её можно определить уникально;
- не используйте `waitForTimeout`, `force: true`, `.only`, `skip` и `page.pause()`.

Подробные правила автотестов находятся в [CODEX.md](CODEX.md), чек-лист ревью — в [REVIEW.md](REVIEW.md).

## Диагностические workflows

Узкие проверки вроде `Registration Contract Smoke` и `Telegram Notification Test` запускаются вручную. Они помогают локализовать конкретную инфраструктурную/интеграционную проблему, но не заменяют основной PR CI.

Stability workflow также используется отдельно для исследования flaky-поведения и всегда сохраняет `retries=0`.

## Pull Request

PR должен отвечать на три вопроса:

1. Что изменено?
2. Зачем это изменение нужно?
3. Как проверено, что поведение не сломано?

Не смешивайте в одном PR несвязанные рефакторинги, функциональные изменения и косметическую правку. Для нестабильных или рискованных изменений укажите известные ограничения и результаты проверок.
