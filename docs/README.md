# PomidorQA QA Documentation Map

This directory organizes portfolio documentation by engineering decision and operating concern instead of duplicating the root README.

| Document | Purpose | Use it when |
| --- | --- | --- |
| [Risk-Based Test Strategy](./test-strategy.md) | Defines quality objectives, risk model, ownership boundaries, test levels, entry/exit criteria, failure triage and useful metrics | deciding what should be tested, where, how deeply and what evidence is sufficient |
| [Quality Gates](./quality-gates.md) | Defines merge-blocking signals, non-blocking diagnostics and evidence expectations | reviewing a PR, CI result or release-quality decision |
| [Architecture](./architecture.md) | Explains POM, fixtures, helpers, data ownership, reports and workflow architecture | changing framework structure or understanding failure ownership |
| [CI Incident Runbook](./ci-incident-runbook.md) | Defines signal ownership, severity, triage discipline and evidence-preserving response to CI/regression incidents | diagnosing a failing gate, live regression, platform issue or observability failure |
| [Registration Contract Smoke](./registration-contract-smoke.md) | Documents the manual-only live registration contract check | diagnosing the exact registration POST/303/redirect chain |
| [Interview Guide](./interview-guide.md) | Turns implemented engineering decisions into concise technical explanations | preparing to explain the project in an interview or review |

## Reading order

For a technical review of the repository:

1. start with **Risk-Based Test Strategy** to understand why the suite exists and which risks it controls;
2. read **Quality Gates** to understand which signals block merge and which remain diagnostic;
3. use **Architecture** for implementation ownership and framework boundaries;
4. use the **CI Incident Runbook** when a signal fails and triage ownership matters;
5. use the **Registration Contract Smoke** document for the narrow live-backend diagnostic path;
6. use the **Interview Guide** only as a communication aid after the engineering documents.

## Documentation principles

- A green pipeline is evidence, not proof of zero defects.
- Product behavior, external-environment health and test-infrastructure health are kept as separate signals.
- Critical live flows use observable causal signals instead of arbitrary sleeps or blind retries.
- Documentation must describe the implementation that exists in `main`; aspirational capabilities are not presented as completed work.
- Changes to runtime contracts, quality gates, incident ownership or test ownership should update the relevant document in the same pull request.
