# Стратегия тестирования на основе рисков

Этот документ описывает, как проект PomidorQA QA Automation переводит риски качества в test scope, уровни тестирования и CI-сигналы.

## Цели

Автоматизация должна давать понятное evidence того, что критичные пользовательские сценарии работают, бизнес-правила сохраняются, а failures можно диагностировать без скрывающих проблему retries и произвольных ожиданий.

Проект работает с внешним учебным live-сервисом PomidorQA. Поэтому поведение продукта, состояние внешнего окружения и состояние тестовой инфраструктуры рассматриваются как разные сигналы.

## Уровни тестирования

### Unit

Unit tests проверяют детерминированную бизнес-логику без браузера и live-окружения. Такой failure считается проблемой в зоне ответственности репозитория.

### API

API tests используют локальные mocks и проверяют request/response contracts без зависимости от доступности live-стенда.

### E2E

E2E проверяет сценарии, которым действительно нужен реальный UI: регистрацию, login, профиль, каталог, availability, booking и cancellation.

Live E2E запускается с `workers=1` и `retries=0`. Это сохраняет первый реальный failure и снижает нагрузку на shared environment.

## Синхронизация

State-changing действия подтверждаются наблюдаемыми сигналами:

- точным mutation response;
- navigation или URL transition;
- ожидаемым UI state;
- Playwright auto-waiting;
- ограниченным polling только там, где подтверждена eventual consistency.

Не используются как способ стабилизации `waitForTimeout`, произвольные sleeps, `force: true` и retries только ради зелёного результата.

## Test data и изоляция

Тестовые данные должны быть уникальны там, где возможны коллизии. Multi-user flows используют отдельные browser contexts. Assertions должны идентифицировать конкретного пользователя, слот, карточку или booking, а не первый совпавший элемент.

## Browser strategy

Функциональный E2E-suite проверяется в:

- Chromium;
- Firefox;
- WebKit.

Отдельные browser reports позволяют отличать общий application failure от engine-specific поведения.

## Non-functional signals

Функциональный E2E дополняют независимые workflows:

- Accessibility Audit;
- Lighthouse Performance Smoke;
- Visual Regression;
- Security & Quality Gates.

Эти сигналы не смешиваются с functional assertions, чтобы причина failure оставалась понятной.

## Required CI evidence

Для обычного Pull Request обязательными сигналами являются:

- `Quality / lint + typecheck`;
- `Unit tests`;
- `API tests`;
- `E2E / Chromium`;
- `E2E / Firefox`;
- `E2E / WebKit`;
- security checks, настроенные в ruleset.

Telegram является вспомогательным observability channel и не заменяет test result.

## Scheduled и diagnostic workflows

Nightly E2E ищет regressions вне конкретного code change. Stability повторяет выбранные сценарии с `retries=0`. Registration Contract Smoke вручную проверяет точную цепочку регистрации `POST → 303 → /pomidorqa`. Telegram diagnostic отдельно проверяет notification integration.

## Failure triage

Красный check сначала классифицируется, а не помечается автоматически как flaky или product bug.

Порядок:

1. сохранить исходный failed run и artifacts;
2. определить owning layer: test code, CI, browser/runtime, external environment или application behavior;
3. проверить trace, screenshots/video, reports и network evidence;
4. сравнить browser matrix и соседние checks;
5. делать targeted rerun только когда есть evidence внешнего временного сбоя;
6. исправлять root cause, а не ослаблять assertions.

## Severity

| Severity | Ориентир |
| --- | --- |
| Blocker | критичный flow недоступен и нет практичного workaround |
| Critical | серьёзное нарушение core behavior |
| Major | существенный дефект с более узким scope или workaround |
| Minor | ограниченный functional/UI impact |
| Trivial | косметическая проблема без значимого functional impact |

Priority оценивается отдельно от Severity.

## Entry criteria

Перед merge должны быть понятны intended behavior и risk, test data должны быть детерминированными, временные debug controls удалены, а документация обновлена при изменении contract или architecture.

## Exit criteria

Изменение готово, когда required checks зелёные на текущем head, diagnostics достаточны для будущего triage, review threads разрешены и нет известной repository-owned blocker/critical regression, которую просто проигнорировали.

Зелёный pipeline — необходимое evidence, но не доказательство отсутствия дефектов.

## Главный принцип

> **Использовать самый маленький детерминированный тест на минимально достаточном уровне, а live E2E — только там, где нужен интегрированный пользовательский сценарий.**
