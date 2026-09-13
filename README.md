# PomidorQA — автоматизация тестирования

[![Playwright QA Automation CI](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/playwright.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/playwright.yml)
[![Nightly E2E Regression](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/nightly.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/nightly.yml)
[![Security & Quality Gates](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/security.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/security.yml)
[![Stability Check](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/stability.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/stability.yml)
[![Accessibility Audit](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/accessibility.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/accessibility.yml)
[![Performance Smoke / Lighthouse](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/performance.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/performance.yml)
[![Visual Regression](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/visual.yml/badge.svg)](https://github.com/TokhirjonYuldoshev/pomidorqa-tests/actions/workflows/visual.yml)

Портфельный проект по автоматизации тестирования на **Playwright + TypeScript**. Он вырос из учебного PomidorQA и развивается как самостоятельная тестовая система: функциональные проверки, CI/CD, диагностика, безопасность, доступность, производительность и визуальные проверки.

Исходный учебный репозиторий: [lebed52/pomidorqa-course-tests](https://github.com/lebed52/pomidorqa-course-tests).

## Что реализовано

| Область | Реализация |
| --- | --- |
| Unit | проверки чистой бизнес-логики без браузера |
| API | локальные HTTP-контракты без зависимости от внешнего стенда |
| E2E | реальные пользовательские сценарии PomidorQA |
| Браузеры | Chromium, Firefox и WebKit |
| Архитектура | Page Object Model, fixtures, helpers, уникальные тестовые данные |
| Подготовка данных | создание тестовых аккаунтов через API там, где UI-регистрация не является предметом проверки |
| Очистка данных | централизованное удаление созданных тестовых аккаунтов перед закрытием `BrowserContext` |
| Отчёты | Playwright HTML, Allure, trace, screenshots, video |
| Доступность | axe-core / WCAG |
| Производительность | Lighthouse |
| Визуальные проверки | сравнение скриншотов в Chromium |
| Безопасность | `npm audit`, проверка изменений зависимостей, CycloneDX SBOM |
| Стабильность | повторные прогоны с `retries=0` |
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

Покрыты положительные и отрицательные сценарии поиска, точное и частичное совпадение, регистр, пробелы, Enter, кириллица и специальные символы, многословные навыки, одинаковые имена/навыки, оба типа навыков, скрытие собственной карточки, обновление выдачи после изменения профиля, удаления аккаунта, появления/исчезновения слотов и каскадных изменений связанных сущностей.

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

Для браузерных E2E используются `workers=1`, `retries=0` и `fail-fast: false`, чтобы сохранить полный сигнал по Chromium, Firefox и WebKit.

## Отдельные проверки качества

- **Accessibility Audit** — axe-core и WCAG;
- **Performance Smoke / Lighthouse** — производительность и технические показатели публичных страниц;
- **Visual Regression** — визуальные изменения login/register;
- **Nightly E2E Regression** — плановая проверка внешнего стенда;
- **Stability Check** — повторные запуски без retries;
- **Registration Contract Smoke** — ручная проверка `POST /pomidorqa/auth/register → 303 → /pomidorqa`;
- **Telegram Notification Test** — ручная диагностика интеграции Telegram.

Эти сигналы отделены от функционального E2E, чтобы причина сбоя оставалась понятной.

## Отчёты и диагностика

Playwright формирует HTML-отчёт и данные Allure. При ошибках сохраняются trace, screenshots, video и `test-results`. В GitHub Actions отчёты разделены по браузерам и доступны как artifacts.

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

Для другого браузера:

```bash
E2E_BROWSER=firefox npm run test:e2e
E2E_BROWSER=webkit npm run test:e2e
```

## Основные команды

| Команда | Назначение |
| --- | --- |
| `npm run verify:local` | Node 24 + ESLint + TypeScript + Unit + API |
| `npm run lint` | статический анализ ESLint |
| `npm run typecheck` | проверка типов TypeScript |
| `npm run test:unit` | Unit |
| `npm run test:api` | API |
| `npm run test:e2e` | E2E в выбранном браузере |
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
- [docs/test-strategy.md](docs/test-strategy.md) — стратегия тестирования;
- [docs/architecture.md](docs/architecture.md) — архитектура;
- [docs/quality-gates.md](docs/quality-gates.md) — обязательные проверки перед слиянием;
- [docs/ci-incident-runbook.md](docs/ci-incident-runbook.md) — порядок разбора сбоев CI;
- [docs/interview-guide.md](docs/interview-guide.md) — подготовка к техническому собеседованию;
- [docs/registration-contract-smoke.md](docs/registration-contract-smoke.md) — ручная проверка контракта регистрации.

## Цель проекта

Репозиторий показывает не количество тестов как самоцель, а управляемую систему качества: независимые уровни проверок, контролируемые тестовые данные, честный `retries=0`, диагностику, обязательные проверки перед слиянием и отдельные сигналы для нефункциональных рисков.