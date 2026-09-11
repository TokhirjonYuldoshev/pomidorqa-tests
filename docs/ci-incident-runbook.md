# QA Automation CI Incident Runbook

This runbook defines how failures are triaged across Unit, API, live E2E, reporting, non-functional workflows and security gates. The objective is to keep independent quality signals explicit and to avoid making CI green by weakening the test strategy.

## Signal ownership

| Signal | Source of truth | Blocking context | First triage action |
| --- | --- | --- | --- |
| Lint / TypeScript | `Quality / lint + typecheck` | PR / main | Fix static/type contract before browser analysis |
| Unit tests | `Unit tests` | PR / main | Inspect isolated business-logic assertion |
| API tests | `API tests` | PR / main | Inspect mock HTTP contract and assertion |
| Chromium / Firefox / WebKit | corresponding E2E job | PR / main | Separate test-code regression from live-environment failure |
| Security | Security workflow | PR / main according to gate policy | Identify audit/dependency/code-quality owner |
| Accessibility / Lighthouse / Visual | dedicated workflow | According to enforcement mode | Inspect dedicated report; do not mix with functional E2E |
| Nightly regression | scheduled browser matrix | Operational regression signal | Compare against recent main/PR evidence and live-site health |
| Registration Contract Smoke | manual workflow | Diagnostic, not PR gate | Validate exact POST/303/redirect chain |
| Telegram | notification/diagnostic workflow | Non-blocking observability | Diagnose transport separately from test result |

## Core triage sequence

1. Identify the **first owning signal** that is red; do not start from the final notification.
2. Preserve the original run, artifacts, trace, screenshots, video, Allure and Playwright HTML evidence.
3. Classify the failure as test-code regression, application regression, live-environment/data propagation issue, browser-specific behavior, CI infrastructure, security finding, or observability transport.
4. Reproduce the **smallest relevant scope**. Unit/API failures should not trigger a full browser rerun for diagnosis.
5. Fix the owning layer and validate through the normal PR gates.
6. Keep `retries=0` for the live browser matrix so the first real failure remains visible.

## Unit and API failures

Unit tests are isolated from the live site. A red Unit job is treated as a deterministic code/test contract failure until evidence proves otherwise.

API tests use the local mock contract and are also expected to be deterministic. Investigate route/method/status/payload assertions before considering external infrastructure.

Do not rerun deterministic failures simply to seek a green result.

## Live E2E failures

The browser matrix intentionally uses `workers=1` and `retries=0`.

When E2E fails:

- inspect the exact failed test step and browser;
- inspect trace, screenshot/video and network/navigation evidence;
- compare Chromium, Firefox and WebKit outcomes;
- determine whether unique test data was successfully created and became observable on the live site;
- distinguish application behavior from delayed/failed catalog indexing or other live-state propagation;
- check whether a recent scheduled Nightly run on the same main revision supports or contradicts an environment hypothesis.

### External/live-environment policy

A rerun is not a substitute for diagnosis. One targeted diagnostic rerun is allowed only after there is concrete evidence that an external condition recovered or when independent evidence strongly indicates the failure was outside the changed code path.

If that rerun fails again, stop rerunning and investigate the owning failure. Do not add `waitForTimeout`, arbitrary sleeps, blanket retries, or inflated timeouts to hide live-site slowness.

## Cross-browser interpretation

- **One browser fails, others pass:** investigate browser-specific DOM/event/rendering behavior and Playwright engine compatibility.
- **All browsers fail at the same product state:** prioritize shared test data, application behavior, backend/live-state propagation, or common helper logic.
- **Quality/Unit/API fail before E2E:** fix those deterministic gates first; browser failures are secondary evidence.

The browser matrix uses `fail-fast: false` so one engine does not suppress evidence from the others.

## Registration failures

Registration E2E synchronizes with the exact registration mutation response. The valid observed contract is:

```text
POST /pomidorqa/auth/register -> 303 See Other -> /pomidorqa
```

Do not replace the exact mutation filter with broad network matching such as `/api/track`, and do not require `response.ok()` for the valid 303 response.

For uncertain live registration behavior, use the manual-only Registration Contract Smoke rather than weakening normal E2E assertions.

## Security failure

Classify the failing gate:

- `npm audit` / vulnerability exposure;
- dependency-change review;
- code-quality/static-analysis signal.

A dependency or security failure is not resolved by skipping the gate. Document scope and risk when a finding cannot be immediately remediated, and keep enforcement aligned with the documented policy.

## Non-functional failure

Accessibility, Lighthouse and Visual Regression are deliberately separate from functional assertions.

- Accessibility: inspect axe rule, impacted nodes and enforcement mode.
- Lighthouse: identify category/budget regression and compare the affected page only.
- Visual: inspect baseline/current/diff evidence before accepting a baseline change.

Never update a visual baseline solely because the comparison is red; first verify the UI change is intended.

## Nightly failure

Nightly is an operational regression signal, not a reason to make PR checks more tolerant.

Triage:

1. identify browser/test cluster;
2. compare with latest successful main and PR evidence;
3. inspect live-state or application change evidence;
4. preserve artifacts;
5. open/fix the owning regression without pausing Nightly unless the workflow itself is proven defective.

## Telegram-only failure

Telegram is observability, not test truth. If required CI is green but Telegram delivery fails:

- preserve the green CI result;
- use the manual Telegram diagnostic (`getMe` -> `getChat` -> `sendMessage`);
- fix secret/configuration/API transport independently;
- do not fail functional QA because notification delivery is unavailable.

## Severity model

| Severity | Example | Response |
| --- | --- | --- |
| SEV-1 | Confirmed critical user-path regression on live site across browsers | Stop merge/release confidence and investigate immediately |
| SEV-2 | Required Quality/Unit/API/E2E/Security gate broken on main | Restore owning gate before further portfolio/framework changes |
| SEV-3 | Nightly/non-functional regression with core PR gates healthy | Triage promptly using dedicated evidence and policy |
| SEV-4 | Reporting/Telegram presentation or transport issue only | Repair observability without falsifying test health |

## Resolution criteria

An incident is resolved only when:

- the owning signal passes on the corrected revision or the external incident is independently evidenced as recovered;
- required gates still enforce the documented behavior;
- failure diagnostics remain available for the original failure;
- no sleep/retry/timeout workaround masks root cause;
- test documentation or strategy is updated if the incident exposed a missing rule.

## Anti-patterns

Do not:

- enable retries to turn intermittent live failures green;
- use `waitForTimeout`, `force`, `.only`, `skip` or `page.pause()` as CI fixes;
- repeatedly rerun a red browser matrix until it randomly passes;
- merge a code change while a related required deterministic gate is red;
- broaden response/network matching when an exact mutation contract is known;
- accept visual baselines without verifying the intended UI change;
- let notification/reporting failures overwrite the real product/test result.
