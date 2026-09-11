# Security and Responsible Testing Policy

This repository is a public QA Automation portfolio project. It contains test code, CI workflows and documentation; it does not own the PomidorQA production service that the E2E suite exercises.

## Supported scope

Security-sensitive changes in this repository include:

- GitHub Actions workflows and permissions;
- dependency and lockfile changes;
- test helpers that create or submit live test data;
- scripts that call external services;
- handling of CI artifacts, logs and repository secrets.

Product vulnerabilities in the external PomidorQA application are outside this repository's ownership boundary and should be reported to the application's maintainer through their appropriate channel.

## Responsible testing rules

The automated suite is intentionally conservative when interacting with the live service:

- no destructive load, stress or denial-of-service testing;
- no credential stuffing, brute force or privilege-escalation attempts;
- no secret extraction or broad vulnerability scanning;
- no retry loops intended to hide instability or amplify traffic;
- E2E browser jobs run with `workers=1` and `retries=0`;
- temporary test accounts/data are created only when required by a scenario;
- operational diagnostics are kept narrow and purpose-specific.

Manual-only checks that create live state, such as the Registration Contract Smoke, remain opt-in by design.

## Secrets

Secrets must never be committed to the repository or printed to workflow logs.

Repository secrets are consumed only through GitHub Actions secret contexts. Diagnostic workflows must report configuration state without exposing secret values.

If a secret is exposed accidentally:

1. revoke or rotate it immediately;
2. remove it from the repository history if necessary;
3. review workflow logs and artifacts for secondary exposure;
4. document the incident and corrective action without republishing the secret.

## Dependency and supply-chain policy

Dependency updates are proposed through Dependabot and are not trusted solely because they are automated.

Before merge, changes must pass the repository's existing quality gates, including lint/typecheck, Unit, API, cross-browser E2E and security checks where applicable. Major-version updates require explicit compatibility review.

The npm security workflow retains two independent evidence types for 14 days:

- `npm audit` JSON for vulnerability findings;
- a CycloneDX SBOM generated from the exact `npm ci` dependency state.

The blocking threshold is **high / critical**. Lower-severity findings are not hidden: they remain visible in retained evidence and, when no safe upstream remediation is currently available, are tracked explicitly as owned risk instead of being suppressed by lockfile edits, blanket ignores, unsafe downgrades or ad-hoc threshold changes.

A lower-severity dependency risk is considered responsibly handled only when its owner, advisory, current dependency state and remediation trigger are visible. For the currently observed `adm-zip` moderate advisory, see issue #55.

## Security risk decisions

A dependency finding may remain below the blocking threshold only when all of the following are true:

1. the severity and realistic exploit conditions are understood;
2. the finding is visible in retained CI evidence;
3. a supported remediation path has been checked rather than assumed;
4. the repository does not weaken unrelated gates to obtain a green build;
5. the finding has an explicit re-evaluation trigger, such as an upstream patched release or owning-parent dependency update.

When a supported remediation exists, it must enter through a normal focused dependency change and pass the same Quality, Unit, API, Chromium, Firefox, WebKit and security gates as other changes.

## Reporting a repository security issue

For a vulnerability in this repository itself, open a minimal private security report through GitHub's security reporting capability when available. If private reporting is unavailable, contact the repository owner without publishing credentials, exploit payloads or sensitive details in a public issue.

A useful report includes:

- affected file/workflow and commit SHA;
- impact and realistic abuse scenario;
- minimal reproduction steps;
- relevant logs with secrets redacted;
- suggested mitigation when known.

## Triage principles

Security findings are classified by impact, exploitability and ownership boundary. A failing security gate is investigated as a real signal first; it is not bypassed by retries, blanket ignores or weakened thresholds without documented evidence.

---

**Portfolio repository — Tokhirjon Yuldoshev**
