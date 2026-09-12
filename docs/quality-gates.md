# Политика QA Quality Gates

Документ фиксирует, какие сигналы блокируют merge, какие остаются диагностическими и как разбирать красный CI без ослабления проверок.

## Защита `main`

`main` защищён активным ruleset **Protect main**. Изменения проходят через Pull Request, review threads должны быть разрешены, linear history обязательна, deletion и non-fast-forward updates запрещены. Разрешён только **squash merge**.

Обязательные checks:

| Check | Что подтверждает |
| --- | --- |
| `Quality / lint + typecheck` | ESLint + TypeScript |
| `Unit tests` | изолированную бизнес-логику |
| `API tests` | локальные HTTP contracts |
| `E2E / Chromium` | live user flows в Chromium |
| `E2E / Firefox` | live user flows в Firefox |
| `E2E / WebKit` | live user flows в WebKit |
| `Security / npm audit` | high/critical dependency gate |
| `Security / dependency change review` | consistency manifest/lockfile и dependency review |
| `Security / code quality` | независимый ESLint + TypeScript signal |

Required checks работают в strict-режиме: перед merge PR проверяется относительно актуального base.

## Blocking и diagnostic signals

В merge gate входят lint/typecheck, Unit, API, browser matrix и три security checks. Остальные workflows дают отдельное evidence:

| Signal | Роль |
| --- | --- |
| Accessibility | informational по умолчанию, ручной `enforce=true` может сделать violations blocking |
| Lighthouse | performance-quality smoke, ручной enforcement доступен отдельно |
| Visual Regression | отдельный сигнал layout changes |
| Nightly E2E | operational regression signal вне конкретного PR |
| Stability | повторные запуски с `retries=0` для поиска нестабильности |
| Registration Contract Smoke | manual-only проверка `POST → 303 → /pomidorqa` |
| Telegram diagnostics | проверка notification/configuration, не источник test truth |

## Triage красного CI

Сначала определяется первый owning signal, а уже потом причина:

1. product/contract failure;
2. test/framework defect;
3. environment/external dependency;
4. security/dependency failure;
5. observability failure.

Не допускается делать CI зелёным за счёт `waitForTimeout`, произвольных sleeps, forced actions, `.only`, `skip`, blanket retries или необоснованного увеличения timeout.

## Детерминизм

Для live E2E, Nightly и Stability сохраняется `retries=0`. State-changing сценарии синхронизируются по точным mutation responses, navigation/URL transitions, UI state changes и Playwright auto-waiting. Ограниченный polling допустим только при подтверждённой eventual consistency.

## Evidence

В зависимости от workflow сохраняются Playwright HTML, Allure, trace/screenshots/video, test-results, npm audit JSON, accessibility/Lighthouse reports, visual diffs, Registration Contract summary и GitHub Actions Summary.

Artifacts помогают диагностике, но не переписывают pass/fail semantics. Сбой Telegram не меняет известный результат тестов.

## Dependency changes

Dependabot PR проходят тот же набор обязательных gates. Minor/patch updates могут группироваться, major updates остаются отдельными для явного compatibility review.

## Минимальное evidence по типу изменения

| Изменение | Минимум |
| --- | --- |
| docs/metadata | consistency документации и отсутствие ложных claims |
| Unit/API | Quality + затронутый test layer |
| E2E/POM/helper/fixture | Quality + prerequisites + browser matrix |
| dependency/runtime | audit + Quality + Unit/API + browser matrix |
| workflow | проверка изменённого path и сохранение required check names |
| registration contract | E2E registration + manual smoke при диагностике |
| non-functional | соответствующий workflow и functional CI, если меняется behavior code |

## Merge decision

PR готов к merge, когда required checks зелёные, review threads разрешены, failure visibility не ослаблена, документация соответствует реализации и в изменение не добавлены unrelated workarounds.

Главный принцип: **нужны независимые и объяснимые QA-сигналы, а не просто зелёный badge**.
