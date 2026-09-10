# QA Quality Gate Policy

This document describes how the repository turns test evidence into merge and operational decisions. The intent is to keep failures visible, separate product risk from infrastructure noise, and avoid hiding instability with retries or arbitrary waits.

## 1. Merge policy for `main`

`main` is protected by the active **Protect main** ruleset. Changes must go through a pull request, required review threads must be resolved, linear history is enforced, deletion and non-fast-forward updates are blocked, and only squash/rebase merges are allowed.

The required PR checks are:

| Required check | Purpose |
| --- | --- |
| `Quality / lint + typecheck` | Static correctness: ESLint + TypeScript |
| `Unit tests` | Isolated business-logic checks |
| `API tests` | Local HTTP contract checks |
| `E2E / Chromium` | Live user-flow validation in Chromium |
| `E2E / Firefox` | Live user-flow validation in Firefox |
| `E2E / WebKit` | Live user-flow validation in WebKit |
| `Security / npm audit` | High/critical dependency vulnerability gate |
| `Security / dependency change review` | Lockfile/manifest consistency and audit for dependency changes |
| `Security / code quality` | Independent ESLint + TypeScript security/quality signal |

Required checks use strict status-check semantics, so the PR is validated against the current base before merge.

## 2. Blocking vs operational signals

Not every useful QA signal belongs in the merge gate. The repository intentionally separates **blocking merge validation** from **scheduled/manual diagnostic evidence**.

### Blocking on pull requests

- lint + typecheck;
- unit tests;
- API tests;
- live E2E in Chromium / Firefox / WebKit;
- npm audit at high/critical threshold;
- dependency-change review;
- independent code-quality gate.

### Operational / non-functional evidence

| Signal | Default behavior | Escalation path |
| --- | --- | --- |
| Accessibility | Informational scheduled/path-scoped audit | Manual `enforce=true` blocks serious/critical violations |
| Lighthouse | Informational scheduled/path-scoped budgets | Manual `enforce=true` turns budget misses into failures |
| Visual regression | Scheduled/path-scoped comparison | Any actual screenshot mismatch fails the workflow |
| Nightly E2E | Full scheduled browser regression | Failure is investigated as product/environment/test signal |
| Stability | Manual repeat-each stress run, `retries=0` | Any observed failure fails the workflow |
| Registration Contract Smoke | Manual-only live HTTP contract check | Fails when the expected `POST → 303 → /pomidorqa` contract changes |
| Telegram diagnostics | Manual operational check | Separates secret/config/transport failures from test failures |

This split prevents a noisy non-functional or external signal from silently becoming a permanent merge blocker while still preserving actionable evidence.

## 3. Failure triage model

A failed check is classified before code is changed:

1. **Product/contract failure** — application behavior differs from the asserted contract.
2. **Test/framework defect** — locator, helper, fixture, assertion or test-data setup is wrong.
3. **Environment/external dependency** — live site, browser infrastructure, network or third-party service is unavailable or degraded.
4. **Security/dependency failure** — vulnerable or incompatible dependency state is detected.
5. **Observability failure** — reporting/notification transport failed while the underlying product signal is still known.

The classification determines the response. The project does not add retries, sleeps or inflated timeouts merely to make a red run green.

## 4. Determinism policy

The project keeps `retries=0` for normal live E2E, Nightly and Stability validation so first-order failures remain visible.

State-changing scenarios synchronize on observable application signals:

- exact mutation responses;
- navigation/URL transitions;
- explicit UI state changes;
- Playwright auto-waiting;
- narrowly justified polling only where real eventual consistency is demonstrated.

`waitForTimeout`, forced actions, `.only`, skipped tests and arbitrary reload loops are not accepted as stabilization techniques.

## 5. Evidence required from CI

A useful failure must preserve enough evidence to distinguish product, test and environment causes. Depending on the workflow, CI publishes:

- Playwright HTML reports;
- Allure reports;
- trace / screenshot / video / test-results artifacts;
- npm audit JSON;
- accessibility reports;
- Lighthouse JSON reports;
- visual snapshots/diffs;
- Registration Contract JSON summary;
- GitHub Actions summaries;
- Telegram notification as an auxiliary channel.

Artifacts are evidence, not the source of truth for pass/fail semantics. Notification failures must not overwrite a known test or product result.

## 6. Dependency-change policy

Dependency updates are proposed through controlled Dependabot pull requests. Minor/patch updates may be grouped to reduce noise; major updates stay isolated for explicit review.

A dependency PR is treated like any other code change: lockfile consistency, audit, static checks, Unit/API and all three E2E browser gates must succeed before merge.

## 7. Risk-based change review

Before changing a test or workflow, evaluate the affected risk area:

| Change type | Minimum evidence expected |
| --- | --- |
| Pure docs/metadata | Repository consistency; no false technical claims |
| Unit/API implementation | Quality + affected local test layer |
| E2E/POM/helper/fixture | Quality + Unit/API prerequisites + full browser matrix |
| Dependency/runtime | Audit + quality + Unit/API + browser matrix |
| CI/workflow logic | Validate changed workflow path and preserve required check names |
| Live registration contract | E2E registration coverage + manual Registration Contract Smoke when diagnosis is required |
| Visual/accessibility/performance | Corresponding non-functional workflow plus functional CI when behavior code changes |

The objective is not "maximum number of tests". The objective is **sufficient, independent evidence for the risk introduced by the change**.

## 8. Merge decision

A change is ready to merge when:

- required status checks are green;
- no unresolved review thread remains;
- the change does not weaken failure visibility;
- documentation matches actual behavior;
- no unrelated workaround is bundled into the PR;
- new diagnostics have a clear ownership/lifecycle and are not left as accidental temporary workflows.

This policy keeps the repository optimized for trustworthy QA signals rather than cosmetic green builds.
