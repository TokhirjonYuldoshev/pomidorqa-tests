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

Security workflow evidence is retained as CI artifacts so a green high/critical gate does not erase visibility into lower-severity findings.

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
