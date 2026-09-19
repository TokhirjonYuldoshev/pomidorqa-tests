#!/usr/bin/env node

import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, join } from "node:path";

const reportsRoot =
  process.argv[2] ?? ".qa-artifacts/ci-machine-reports";
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function statusLabel(value) {
  switch (value) {
    case "success":
      return "✅ Успешно";
    case "failure":
      return "❌ Ошибка";
    case "cancelled":
      return "⏹️ Отменено";
    case "skipped":
      return "⏭️ Пропущено";
    default:
      return "❔ " + (value || "unknown");
  }
}

function eventLabel(value) {
  switch (value) {
    case "pull_request":
      return "Pull Request";
    case "push":
      return "Push в репозиторий";
    case "workflow_dispatch":
      return "Ручной запуск";
    default:
      return value || "unknown";
  }
}

function formatSeconds(ms) {
  return (Number(ms || 0) / 1000).toFixed(1) + " s";
}

function formatMinutes(ms) {
  return (Number(ms || 0) / 60000).toFixed(1) + " min";
}

function formatDuration(ms) {
  return Number(ms || 0) >= 120000
    ? formatMinutes(ms)
    : formatSeconds(ms);
}

function collectTests(suite, project, out) {
  const suiteProject = /^(unit|api|e2e)$/.test(suite.title ?? "")
    ? suite.title
    : project;

  for (const spec of suite.specs ?? []) {
    for (const currentTest of spec.tests ?? []) {
      const results = currentTest.results ?? [];
      out.push({
        title: spec.title,
        file: spec.file ?? "",
        project:
          currentTest.projectName ||
          suiteProject ||
          "unknown",
        status: currentTest.status,
        expectedStatus: currentTest.expectedStatus,
        duration: results.reduce(
          (sum, result) =>
            sum + Number(result.duration ?? 0),
          0,
        ),
        attempts: results.length,
      });
    }
  }

  for (const child of suite.suites ?? []) {
    collectTests(child, suiteProject, out);
  }
}

function summarizeReport(report) {
  const tests = [];

  for (const suite of report.suites ?? []) {
    collectTests(suite, null, tests);
  }

  const unexpected = tests.filter(
    (test) => test.status === "unexpected",
  );
  const flaky = tests.filter(
    (test) => test.status === "flaky",
  );
  const skipped = tests.filter(
    (test) => test.status === "skipped",
  );
  const expectedFailures = tests.filter(
    (test) => test.expectedStatus === "failed",
  );
  const retried = tests.filter(
    (test) => test.attempts > 1,
  );

  return {
    total: tests.length,
    passedAsExpected:
      tests.length -
      unexpected.length -
      flaky.length -
      skipped.length,
    expectedFailures: expectedFailures.length,
    unexpected: unexpected.length,
    flaky: flaky.length,
    skipped: skipped.length,
    retried: retried.length,
    duration:
      report.stats?.duration ??
      tests.reduce(
        (sum, test) => sum + test.duration,
        0,
      ),
    slowest: [...tests]
      .sort(
        (left, right) =>
          right.duration - left.duration,
      )
      .slice(0, 3),
    failures: unexpected.slice(0, 8),
  };
}

function walkFiles(root) {
  if (!existsSync(root)) {
    return [];
  }

  const files = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...walkFiles(path));
    } else {
      files.push(path);
    }
  }

  return files;
}

function browserFromPath(path) {
  const normalized = path.replaceAll("\\", "/");
  const match = normalized.match(
    /machine-report-(chromium|firefox|webkit)-/,
  );

  if (match) {
    return match[1];
  }

  const parent = basename(
    normalized.split("/test-results")[0],
  );
  return (
    parent.match(
      /machine-report-(chromium|firefox|webkit)-/,
    )?.[1] ?? null
  );
}

function readBrowserMetrics(root) {
  const result = new Map();

  for (const path of walkFiles(root)) {
    if (!path.endsWith("results.json")) {
      continue;
    }

    const browser = browserFromPath(path);

    if (!browser) {
      continue;
    }

    try {
      const report = JSON.parse(
        readFileSync(path, "utf8"),
      );
      result.set(browser, summarizeReport(report));
    } catch (error) {
      console.warn(
        "Не удалось разобрать " +
          path +
          ": " +
          error.message,
      );
    }
  }

  return result;
}

function parsePortfolioMetrics() {
  const readme = readFileSync("README.md", "utf8");
  const matrix = readFileSync(
    "docs/coverage-matrix.md",
    "utf8",
  );

  function numberFromRow(label) {
    const escaped = label.replace(
      /[.*+?^$(){}|[\]\\]/g,
      "\\$&",
    );
    const match = readme.match(
      new RegExp(
        "^\\|\\s*" +
          escaped +
          "\\s*\\|\\s*(?:\\*\\*)?(\\d+)",
        "m",
      ),
    );

    return match ? Number(match[1]) : null;
  }

  const statuses = [
    "automated",
    "partial",
    "known defect",
    "out of scope",
  ];
  const coverage = Object.fromEntries(
    statuses.map((status) => [
      status,
      [
        ...matrix.matchAll(
          new RegExp(
            "\\|\\s*R\\d+\\.\\d+\\s*\\|[^\\n]*\\|\\s*(?:\\*\\*)?`" +
              status +
              "`(?:\\*\\*)?\\s*\\|",
            "g",
          ),
        ),
      ].length,
    ]),
  );

  return {
    requirements: 50,
    coverage,
    unit: numberFromRow("Unit"),
    api: numberFromRow("API"),
    e2e: numberFromRow("E2E"),
    total: numberFromRow(
      "Всего автоматизированных проверок",
    ),
  };
}

function markdownTable(headers, rows) {
  return [
    "| " +
      headers.map(escapeMarkdown).join(" | ") +
      " |",
    "| " +
      headers.map(() => "---").join(" | ") +
      " |",
    ...rows.map(
      (row) =>
        "| " +
        row.map(escapeMarkdown).join(" | ") +
        " |",
    ),
  ].join("\n");
}

const metrics = readBrowserMetrics(reportsRoot);
const portfolio = parsePortfolioMetrics();

const quality = process.env.QUALITY || "unknown";
const unit = process.env.UNIT || "unknown";
const api = process.env.API || "unknown";
const e2e = process.env.E2E || "unknown";

let overall = "⚠️ ПРОВЕРКИ ЗАВЕРШЕНЫ НЕ ПОЛНОСТЬЮ";
let note =
  "Часть сигналов отсутствует или была пропущена.";

if (
  quality === "success" &&
  unit === "success" &&
  api === "success" &&
  e2e === "success"
) {
  overall = "✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ";
  note =
    "Quality gates, Unit, API и browser matrix завершились успешно.";
} else if (
  [quality, unit, api, e2e].includes("failure")
) {
  overall = "❌ ЕСТЬ ОШИБКИ";
  note =
    "Одна или несколько обязательных проверок завершились с ошибкой.";
} else if (
  [quality, unit, api, e2e].includes("cancelled")
) {
  overall = "⏹️ ЗАПУСК ОТМЕНЁН";
  note =
    "Выполнение pipeline было остановлено.";
}

const server = process.env.GITHUB_SERVER_URL || "https://github.com";
const repository =
  process.env.GITHUB_REPOSITORY || "unknown";
const runId = process.env.GITHUB_RUN_ID || "";
const runNumber =
  process.env.GITHUB_RUN_NUMBER || "";
const runUrl =
  server +
  "/" +
  repository +
  "/actions/runs/" +
  runId;
const artifactsUrl = runUrl + "#artifacts";
const branch =
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  "unknown";
const shortSha = String(
  process.env.GITHUB_SHA || "",
).slice(0, 7);
const actor = process.env.GITHUB_ACTOR || "unknown";
const event = eventLabel(
  process.env.GITHUB_EVENT_NAME,
);

const browserLabels = {
  chromium: "Chromium",
  firefox: "Firefox",
  webkit: "WebKit",
};

const browserRows = [
  "chromium",
  "firefox",
  "webkit",
].map((browser) => {
  const current = metrics.get(browser);

  if (!current) {
    return [
      browserLabels[browser],
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
    ];
  }

  const result =
    current.unexpected === 0 &&
    current.flaky === 0
      ? "✅"
      : "❌";

  return [
    browserLabels[browser],
    result +
      " " +
      current.passedAsExpected +
      "/" +
      current.total,
    current.expectedFailures,
    current.unexpected,
    current.flaky,
    current.retried,
    formatDuration(current.duration),
  ];
});

const allFailures = [];

for (const browser of [
  "chromium",
  "firefox",
  "webkit",
]) {
  const current = metrics.get(browser);

  for (const failure of current?.failures ?? []) {
    allFailures.push({
      browser: browserLabels[browser],
      ...failure,
    });
  }
}

const slowestRows = [];

for (const browser of [
  "chromium",
  "firefox",
  "webkit",
]) {
  const current = metrics.get(browser);

  for (const test of current?.slowest ?? []) {
    slowestRows.push([
      browserLabels[browser],
      formatDuration(test.duration),
      test.title,
    ]);
  }
}

const coverage = portfolio.coverage;
const coverageTotal = Object.values(coverage).reduce(
  (sum, value) => sum + value,
  0,
);

const e2eSpecFiles = walkFiles("tests/e2e").filter(
  (path) => path.endsWith(".spec.ts"),
);
const e2eWithApiArrange = e2eSpecFiles.filter((path) => {
  const source = readFileSync(path, "utf8");

  return [
    "registerUserViaApi",
    "prepareCatalogParticipant",
    "prepareCatalogParticipantWithSkills",
    "registerWithSkill",
  ].some((marker) => source.includes(marker));
});
const e2eWithCleanup = e2eSpecFiles.filter((path) => {
  const source = readFileSync(path, "utf8");

  return (
    source.includes("../fixtures/app-fixtures") ||
    source.includes("deleteUserViaApi")
  );
});

const htmlHeader = `
# Playwright QA Automation CI

_Автоматические проверки проекта • расширенный GitHub Actions Dashboard_

## ${overall}

> ${note}

[▶️ Открыть run](${runUrl}) ·
[📊 Allure](${artifactsUrl}) ·
[🎭 Playwright HTML](${artifactsUrl}) ·
[🧾 JSON / JUnit](${artifactsUrl}) ·
[✈️ Telegram](https://t.me/Tokhirjon_QA_Bot)

---

<table>
<tr>
<td valign="top" width="50%">
<h3>📋 Quality gates</h3>
<table>
<thead><tr><th>Проверка</th><th>Статус</th></tr></thead>
<tbody>
<tr><td>ESLint + TypeScript + Coverage Matrix</td><td>${escapeHtml(statusLabel(quality))}</td></tr>
<tr><td>Unit tests</td><td>${escapeHtml(statusLabel(unit))}</td></tr>
<tr><td>API tests</td><td>${escapeHtml(statusLabel(api))}</td></tr>
<tr><td>E2E / 3 browsers</td><td>${escapeHtml(statusLabel(e2e))}</td></tr>
</tbody>
</table>
</td>
<td valign="top" width="50%">
<h3>🎯 HW16 coverage</h3>
<table>
<thead><tr><th>Метрика</th><th>Значение</th></tr></thead>
<tbody>
<tr><td>Audit completeness</td><td><strong>${coverageTotal} / ${portfolio.requirements}</strong></td></tr>
<tr><td>automated</td><td><strong>${coverage.automated} / 50</strong></td></tr>
<tr><td>partial</td><td>${coverage.partial} / 50</td></tr>
<tr><td>known defect</td><td>${coverage["known defect"]} / 50</td></tr>
<tr><td>out of scope</td><td>${coverage["out of scope"]} / 50</td></tr>
</tbody>
</table>
</td>
</tr>
<tr>
<td valign="top" width="50%">
<h3>🧪 Test inventory</h3>
<table>
<thead><tr><th>Уровень</th><th>Проверок</th></tr></thead>
<tbody>
<tr><td>Unit</td><td>${portfolio.unit ?? "—"}</td></tr>
<tr><td>API</td><td>${portfolio.api ?? "—"}</td></tr>
<tr><td>E2E scenarios</td><td>${portfolio.e2e ?? "—"}</td></tr>
<tr><td><strong>Total</strong></td><td><strong>${portfolio.total ?? "—"}</strong></td></tr>
</tbody>
</table>
</td>
<td valign="top" width="50%">
<h3>⚙️ Execution</h3>
<table>
<thead><tr><th>Параметр</th><th>Значение</th></tr></thead>
<tbody>
<tr><td>Node.js</td><td><strong>24</strong></td></tr>
<tr><td>Browsers</td><td>Chromium · Firefox · WebKit</td></tr>
<tr><td>Workers</td><td><strong>4 per browser</strong></td></tr>
<tr><td>Retries</td><td><strong>0</strong></td></tr>
<tr><td>Reports</td><td>HTML · Allure · JSON · JUnit</td></tr>
</tbody>
</table>
</td>
</tr>
</table>

### 🧹 E2E data discipline

| Показатель | Значение |
| --- | ---: |
| E2E spec files | **${e2eSpecFiles.length}** |
| API / Helper Arrange | **${e2eWithApiArrange.length} / ${e2eSpecFiles.length}** |
| Centralized cleanup | **${e2eWithCleanup.length} / ${e2eSpecFiles.length}** |
`;

const sections = [htmlHeader];

sections.push(
  "## 🌐 Browser matrix\n\n" +
    markdownTable(
      [
        "Browser",
        "Результат",
        "Expected fail",
        "Unexpected",
        "Flaky",
        "Retries",
        "Время",
      ],
      browserRows,
    ),
);

if (allFailures.length > 0) {
  sections.push(
    "## 🚨 Непредвиденные падения\n\n" +
      markdownTable(
        ["Browser", "Файл", "Сценарий"],
        allFailures.map((failure) => [
          failure.browser,
          failure.file,
          failure.title,
        ]),
      ) +
      "\n\n> Для failed job сохранены trace, screenshot/video и Allure/Playwright artifacts.",
  );
}

if (slowestRows.length > 0) {
  sections.push(
    "<details>\n" +
      "<summary><strong>⏱️ Самые медленные сценарии</strong></summary>\n\n" +
      markdownTable(
        ["Browser", "Время", "Сценарий"],
        slowestRows,
      ) +
      "\n\n</details>",
  );
}

sections.push(`
## 📦 Отчёты и evidence

| Evidence | Назначение | Retention |
| --- | --- | ---: |
| [Playwright HTML](${artifactsUrl}) | интерактивный browser report | 14 days |
| [Allure](${artifactsUrl}) | история шагов и вложения | 14 days |
| [JSON + JUnit](${artifactsUrl}) | machine-readable результаты | 14 days |
| [Failure diagnostics](${artifactsUrl}) | trace / screenshots / video | 7 days |
| Requirement coverage | 50/50 ID + test references + README ↔ matrix gate | CI |

## 🛰 Дополнительные quality signals

| Workflow | Что проверяет |
| --- | --- |
| [Security & Quality Gates](${server}/${repository}/actions/workflows/security.yml) | npm audit · dependency review · SBOM · static quality |
| [AI Review](${server}/${repository}/actions/workflows/ai-review.yml) | CODEX-scoped review после зелёного PR CI |
| [Accessibility Audit](${server}/${repository}/actions/workflows/accessibility.yml) | axe-core / WCAG |
| [Performance Smoke / Lighthouse](${server}/${repository}/actions/workflows/performance.yml) | performance · accessibility · best practices · SEO |
| [Visual Regression](${server}/${repository}/actions/workflows/visual.yml) | visual diff в Chromium |
| [Stability Check](${server}/${repository}/actions/workflows/stability.yml) | repeat-each с \`retries=0\` |
| [Nightly E2E](${server}/${repository}/actions/workflows/nightly.yml) | плановая регрессия live-стенда |

## 🚀 Контекст запуска

| Поле | Значение |
| --- | --- |
| Repository | \`${escapeMarkdown(repository)}\` |
| Branch | \`${escapeMarkdown(branch)}\` |
| Event | ${escapeMarkdown(event)} |
| Actor | \`${escapeMarkdown(actor)}\` |
| Commit | \`${escapeMarkdown(shortSha)}\` |
| Run | [#${escapeMarkdown(runNumber)}](${runUrl}) |

<details>
<summary><strong>🧭 Архитектура pipeline</strong></summary>

\`\`\`mermaid
flowchart LR
  A[PR / push / manual] --> Q[Quality + coverage]
  A --> U[Unit]
  A --> P[API]
  Q --> C[Chromium]
  U --> C
  P --> C
  Q --> F[Firefox]
  U --> F
  P --> F
  Q --> W[WebKit]
  U --> W
  P --> W
  C --> S[CI Dashboard]
  F --> S
  W --> S
  C --> R[Reports + artifacts]
  F --> R
  W --> R
  Q --> T[Telegram]
  U --> T
  P --> T
  C --> T
  F --> T
  W --> T
\`\`\`

</details>

---

> **Принцип:** зелёный статус не маскируется retries. \`retries=0\`, browser matrix выполняется после быстрых Quality / Unit / API gates.
`);

const markdown = sections.join("\n\n");

if (summaryPath) {
  appendFileSync(summaryPath, markdown + "\n");
} else {
  console.log(markdown);
}
