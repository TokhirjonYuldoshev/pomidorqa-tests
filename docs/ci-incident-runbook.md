# Runbook по CI incidents

Этот документ фиксирует порядок разбора failures в Unit, API, live E2E, non-functional workflows и CI. Цель — определить owning layer, сохранить evidence и не ослаблять проверки ради зелёного результата.

## Ownership сигналов

| Сигнал | Source of truth | Первое действие |
| --- | --- | --- |
| Lint / TypeScript | `Quality / lint + typecheck` | проверить static/type failure |
| Unit | `Unit tests` | проверить isolated assertion |
| API | `API tests` | проверить mock HTTP contract |
| Chromium / Firefox / WebKit | соответствующий E2E job | отделить test-code regression от live-environment failure |
| Accessibility / Lighthouse / Visual | отдельный workflow | открыть dedicated report |
| Nightly | scheduled browser matrix | сравнить с recent main/PR evidence |
| Registration Contract Smoke | manual workflow | проверить `POST → 303 → /pomidorqa` |
| Telegram | notification workflow | разбирать transport отдельно от test result |

## Порядок triage

1. Найти первый красный owning signal, а не начинать с финального notification.
2. Сохранить исходный run, artifacts, trace, screenshots/video и reports.
3. Определить слой: test code, application behavior, browser/runtime, external environment или CI infrastructure.
4. Воспроизводить минимальный scope.
5. Исправлять owning layer и проверять через обычные PR gates.
6. Для live browser matrix сохранять `retries=0`.

## Unit и API

Unit и mocked API считаются детерминированными. Их failure не требует полного E2E rerun для первичной диагностики.

## Live E2E

Browser matrix работает с `workers=1` и `retries=0`.

При падении нужно:

- проверить exact test step и browser;
- изучить trace, screenshot/video и network/navigation evidence;
- сравнить Chromium, Firefox и WebKit;
- проверить test data и shared state;
- отличить application behavior от проблем live environment.

Один targeted rerun допустим только когда есть конкретное evidence внешнего временного сбоя. Повторные reruns до случайного green не являются triage.

## Cross-browser interpretation

- Один browser красный — проверить engine-specific behavior.
- Все browsers падают одинаково — проверить shared data, application/backend и common helpers.
- Quality/Unit/API уже красные — сначала исправить их.

`fail-fast: false` сохраняет evidence по всем browser engines.

## Registration

Ожидаемый контракт:

```text
POST /pomidorqa/auth/register -> 303 See Other -> /pomidorqa
```

Для узкой диагностики используется manual-only Registration Contract Smoke. Точный mutation filter не заменяется широким network matching.

## Non-functional workflows

Accessibility, Lighthouse и Visual Regression разбираются по своим dedicated reports. Visual baseline обновляется только после подтверждения, что изменение UI действительно ожидаемое.

## Nightly

Nightly — operational regression signal. Нужно определить browser/test cluster, сравнить с recent main/PR evidence и сохранить artifacts. Nightly failure не является поводом делать PR checks мягче.

## Telegram-only failure

Если required CI зелёный, а Telegram delivery упал, test result остаётся зелёным. Notification integration диагностируется отдельно.

## Severity

| Severity | Ориентир |
| --- | --- |
| SEV-1 | критичная подтверждённая live-regression core flow |
| SEV-2 | required gate сломан на `main` |
| SEV-3 | Nightly/non-functional regression при здоровых core PR gates |
| SEV-4 | reporting/notification issue без functional regression |

## Incident закрыт, когда

Owning signal проходит на исправленной revision или внешнее восстановление подтверждено evidence, required gates не ослаблены, исходные diagnostics сохранены и root cause не замаскирован retries/sleeps/timeouts.

## Anti-patterns

Не используются `waitForTimeout`, `force`, `.only`, `skip`, `page.pause()`, blanket retries и многократные reruns без диагностики. Нельзя мержить изменение при красном связанном required gate.
