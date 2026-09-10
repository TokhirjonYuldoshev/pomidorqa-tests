# Risk-Based Test Strategy

## Purpose

This document describes how quality risk is translated into test scope, CI signals and release/merge decisions for the PomidorQA QA Automation portfolio project.

The project exercises a live educational PomidorQA service that is owned outside this repository. The strategy therefore separates **product-quality evidence** from **test-infrastructure health** and keeps potentially state-changing diagnostics narrow and intentional.

## Quality objectives

The automation should provide fast, explainable evidence that:

1. core user journeys still work;
2. business rules around profile visibility, availability and booking are preserved;
3. state-changing actions are confirmed by observable system signals rather than timing guesses;
4. supported browser engines behave consistently;
5. regressions in accessibility, performance, visual rendering and dependency security remain visible;
6. CI failures are diagnosable and are not hidden by automatic retries.

## Ownership boundary

| Area | Ownership in this repository | Evidence |
| --- | --- | --- |
| Unit/business logic examples | Full | deterministic Unit tests |
| Mocked booking/participants API | Full | isolated API tests |
| Live PomidorQA UI behavior | Test consumer only | E2E browser checks |
| PomidorQA backend availability | External dependency | E2E/contract diagnostics |
| CI workflows/reporting | Full | GitHub Actions results and artifacts |
| Telegram delivery | Auxiliary integration | diagnostic workflow / notification result |

A live-site failure is investigated first as a real signal, but is not automatically classified as a product defect until the failing layer is identified.

## Risk model

Risk is evaluated by **impact × likelihood × detectability**. The matrix below drives the depth and frequency of checks.

| Risk | Impact | Primary control | Secondary evidence |
| --- | --- | --- | --- |
| Registration contract breaks | High | E2E registration + manual contract smoke | exact POST response / redirect diagnostics |
| Authentication stops working | High | E2E authentication | trace, screenshot, video |
| User cannot create/manage availability | High | E2E slot/profile flows | mutation response + persisted UI state |
| Booking or cancellation state is inconsistent | High | E2E booking flows | participant-specific assertions + post-action state |
| Catalog returns incorrect participant visibility | High | E2E search/visibility scenarios | unique test data and positive controls |
| Browser-engine regression | Medium/High | Chromium/Firefox/WebKit matrix | per-browser reports |
| Flaky automation hides a defect | High | `retries=0`, stability workflow | repeat-each diagnostics |
| Accessibility regression | Medium | axe-core audit | JSON artifact / optional enforcement |
| Performance regression | Medium | Lighthouse smoke | per-page score artifacts |
| Visual regression | Medium | screenshot comparison | baseline + failure diagnostics |
| Dependency/supply-chain regression | High | npm audit + dependency review | lockfile validation / security workflow |
| Notification transport failure | Low for product quality | Telegram diagnostics | warning only; does not override CI result |

## Test levels

### Unit

Use Unit tests for deterministic business logic that does not require a browser or live service. Unit failures are treated as repository-owned defects and should block merge.

### API

The API layer uses isolated HTTP mocks for booking/participants contracts. The goal is fast validation of request/response behavior without coupling every contract assertion to live-site availability.

### E2E

E2E covers the critical user journeys and business rules that require the real UI and live service:

- registration;
- authentication;
- profile management;
- catalog search and participant visibility;
- booking creation;
- booking cancellation;
- concurrent competition for one slot;
- requirement for a future free slot;
- repeated search without page reload.

Live E2E runs with `workers=1` and `retries=0`. This intentionally favors signal quality and low load on the shared environment over throughput.

## Synchronization policy

State-changing actions should wait for an observable causal signal:

- exact mutation HTTP response where the contract is known;
- URL/navigation transition;
- appearance/disappearance of the expected UI state;
- Playwright auto-waiting;
- bounded polling/reload only when eventual consistency has been demonstrated.

The following are not accepted as stabilization strategies:

- `waitForTimeout` / arbitrary sleeps;
- `force: true` to bypass interaction problems;
- blind retries that turn an intermittent failure green;
- broad network waits that can match unrelated requests.

## Test data and isolation

- Test users and searchable skills are unique per run/scenario where collision risk exists.
- Multi-user flows use isolated browser contexts.
- Assertions identify the intended user/card/booking rather than selecting the first matching element.
- Test setup should establish positive controls before negative assertions when an empty or stale catalog could otherwise create a false pass.
- Live state is created only when required by the scenario.

## Browser strategy

Automatic E2E validation covers:

- Chromium;
- Firefox;
- WebKit.

The same functional suite is used across engines so cross-browser differences remain comparable. Browser-specific failures retain separate reports and artifacts.

## Non-functional strategy

### Accessibility

axe-core provides a dedicated WCAG signal. The normal scheduled/informational path preserves findings without making every existing issue a functional blocker. Manual enforcement is available when a clean threshold is required.

### Performance

Lighthouse smoke covers the catalog, login and registration pages. Performance, Accessibility, Best Practices and SEO scores are recorded separately from functional correctness.

### Visual regression

Screenshot baselines cover selected public pages in Chromium. Visual evidence is intentionally separated from functional assertions so a layout change cannot obscure whether the user flow still works.

### Security

Security gates cover dependency audit, dependency-change review and code-quality checks. Dependency updates are proposed through controlled Dependabot PRs and must pass the normal validation pipeline before merge.

## CI quality gates

For normal code changes, merge evidence is expected from:

1. Quality / lint + typecheck;
2. Unit tests;
3. API tests;
4. E2E / Chromium;
5. E2E / Firefox;
6. E2E / WebKit;
7. Security gates;
8. generated reporting/summary steps associated with the run.

`main` is protected through repository rules. Required checks should reflect stable quality signals, not convenience integrations such as Telegram delivery.

## Scheduled and diagnostic checks

| Workflow type | Purpose | Merge blocker? |
| --- | --- | --- |
| PR/push browser CI | regression validation | Yes |
| Security & Quality | dependency/code-quality risk | Yes where configured as required |
| Nightly E2E | detect environment/product regressions outside code changes | No direct PR blocker |
| Stability | detect intermittent behavior with repeated execution | Diagnostic |
| Accessibility | non-functional WCAG signal | Informational by default / enforceable manually |
| Lighthouse | performance-quality trend/smoke | Informational by default / enforceable manually |
| Visual Regression | layout change signal | Separate non-functional signal |
| Registration Contract Smoke | narrow live registration-contract diagnosis | Manual only |
| Telegram diagnostic | integration/configuration diagnosis | Manual only |

## Failure triage

A red check is not immediately labelled "flaky" or "product bug". Triage follows this order:

1. **Reproduce the exact failing assertion/signal** from the first run.
2. **Classify the failing layer:** test code, CI infrastructure, browser/runtime, external service, or product behavior.
3. **Use existing evidence:** trace, screenshot, video, Allure/HTML report, HTTP response details and workflow logs.
4. **Compare cross-browser and neighboring checks** to determine scope.
5. **Re-run once only when evidence suggests an external/transient failure** and the re-run itself adds diagnostic value.
6. **Fix root cause or document the external dependency issue**; do not weaken assertions just to restore green CI.

## Defect severity guidance

| Severity | Typical example |
| --- | --- |
| Blocker | critical flow is impossible for all users and no practical workaround exists |
| Critical | major data/state integrity or security-impacting behavior in a core flow |
| Major | core feature is materially wrong but a workaround or narrower scope exists |
| Minor | limited functional/UI defect with low business impact |
| Trivial | cosmetic issue with no meaningful functional impact |

Priority is kept separate from severity and depends on release/business urgency.

## Entry criteria for a change

Before requesting merge:

- the intended behavior and risk are understood;
- changed tests have deterministic data/setup;
- local fast preflight has been run when applicable;
- no temporary debug controls (`only`, `skip`, `page.pause`, arbitrary sleeps) remain;
- documentation is updated when the contract or architecture changes.

## Exit criteria for merge

A change is ready when:

- required CI checks are green on the current head;
- new/changed behavior has an appropriate test-level signal;
- diagnostics are sufficient to investigate a future failure;
- no known blocker/critical repository-owned regression is being waived;
- dependency/security changes have passed their dedicated checks;
- review threads are resolved where applicable.

A green pipeline is necessary evidence, not proof that the product has zero defects.

## Metrics that matter

The project intentionally avoids vanity metrics such as maximizing test count. Useful signals are:

- required-check pass/fail rate;
- first-run failure rate;
- stability/repeat failure rate;
- time to identify the failing layer;
- browser-specific failure distribution;
- non-functional findings/trends;
- percentage of failures with actionable artifacts;
- dependency/security gate outcomes.

## Out of scope

The portfolio suite does not perform:

- destructive load or denial-of-service testing against the live educational service;
- broad vulnerability exploitation/scanning;
- production data manipulation outside test scenarios;
- automatic retries intended to conceal shared-environment instability.

## Decision principle

The guiding rule is:

> **Prefer the smallest deterministic test at the lowest useful layer, and use live E2E only for risks that require the integrated user journey.**

This keeps the suite explainable, lowers environmental coupling and makes failures more useful for engineering decisions.
