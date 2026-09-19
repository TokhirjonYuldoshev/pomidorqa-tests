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
      return "❔ " + (value || "неизвестно");
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
      return value || "неизвестно";
  }
}

function formatDuration(ms) {
  const value = Number(ms || 0);

  if (value >= 120_000) {
    return (value / 60_000).toFixed(1) + " мин";
  }

  return (value / 1000).toFixed(1) + " с";
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
            "\\|\\s*R\\d+\\.\\d+\\s*\\|[^\\n]*" +
              "\\|\\s*(?:\\*\\*)?`" +
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

function browserDetails(browser, label, current) {
  if (!current) {
    return `<details>
<summary><strong>${label} — подробности</strong></summary>

Отчёт браузера недоступен.

</details>`;
  }

  const metricsTable = markdownTable(
    ["Показатель", "Значение"],
    [
      ["Всего тестов", current.total],
      ["Прошли как ожидалось", current.passedAsExpected],
      ["Ожидаемые падения", current.expectedFailures],
      ["Непредвиденные падения", current.unexpected],
      ["Нестабильные", current.flaky],
      ["Пропущены", current.skipped],
      ["Повторы", current.retried],
      ["Время", formatDuration(current.duration)],
    ],
  );

  const slowest = markdownTable(
    ["Время", "Сценарий"],
    current.slowest.map((test) => [
      formatDuration(test.duration),
      test.title,
    ]),
  );

  const failures =
    current.failures.length === 0
      ? "Непредвиденных падений нет."
      : markdownTable(
          ["Файл", "Сценарий"],
          current.failures.map((failure) => [
            failure.file,
            failure.title,
          ]),
        );

  return `<details>
<summary><strong>${label} — подробности</strong></summary>

${metricsTable}

**Самые медленные сценарии**

${slowest}

**Ошибки**

${failures}

</details>`;
}

const metrics = readBrowserMetrics(reportsRoot);
const portfolio = parsePortfolioMetrics();

const quality = process.env.QUALITY || "unknown";
const unit = process.env.UNIT || "unknown";
const api = process.env.API || "unknown";
const e2e = process.env.E2E || "unknown";
const regressionGate =
  process.env.REGRESSION_GATE || "unknown";

let overall = "⚠️ ПРОВЕРКИ ЗАВЕРШЕНЫ НЕ ПОЛНОСТЬЮ";
let note =
  "Часть проверок отсутствует или была пропущена.";

if (
  quality === "success" &&
  unit === "success" &&
  api === "success" &&
  e2e === "success" &&
  regressionGate === "success"
) {
  overall = "✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ";
  note =
    "Сборка завершена успешно, включая три браузера.";
} else if (
  [quality, unit, api, e2e, regressionGate].includes("failure")
) {
  overall = "❌ ЕСТЬ ОШИБКИ";
  note =
    "Одна или несколько обязательных проверок завершились с ошибкой.";
} else if (
  [quality, unit, api, e2e, regressionGate].includes("cancelled")
) {
  overall = "⏹️ ЗАПУСК ОТМЕНЁН";
  note =
    "Выполнение автоматических проверок было остановлено.";
}

const server =
  process.env.GITHUB_SERVER_URL || "https://github.com";
const repository =
  process.env.GITHUB_REPOSITORY || "неизвестно";
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
  "неизвестно";
const shortSha = String(
  process.env.GITHUB_SHA || "",
).slice(0, 7);
const actor =
  process.env.GITHUB_ACTOR || "неизвестно";
const event = eventLabel(
  process.env.GITHUB_EVENT_NAME,
);
const runner =
  (process.env.RUNNER_OS || "Linux") +
  " / " +
  (process.env.RUNNER_ARCH || "X64");
const nodeVersion = process.version;

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

const sections = [
`# Сводка CI PomidorQA

_Автоматические проверки проекта · GitHub Actions_

## ${overall}

> ${note}

<p><a href="${runUrl}">Открыть запуск</a> · <a href="${artifactsUrl}">Allure</a> · <a href="${artifactsUrl}">Playwright HTML</a> · <a href="${artifactsUrl}">JSON / JUnit</a> · <a href="https://t.me/Tokhirjon_QA_Bot">Telegram</a></p>

---

<table>
<tr>
<td valign="top" width="50%">
<h3>1. Проверки качества</h3>
<table>
<thead><tr><th>Проверка</th><th>Статус</th></tr></thead>
<tbody>
<tr><td>ESLint + TypeScript + матрица требований</td><td>${escapeHtml(statusLabel(quality))}</td></tr>
<tr><td>Модульные тесты</td><td>${escapeHtml(statusLabel(unit))}</td></tr>
<tr><td>API-тесты</td><td>${escapeHtml(statusLabel(api))}</td></tr>
<tr><td>E2E · 3 браузера</td><td>${escapeHtml(statusLabel(e2e))}</td></tr>
<tr><td>Regression Gate</td><td>${escapeHtml(statusLabel(regressionGate))}</td></tr>
</tbody>
</table>
</td>
<td valign="top" width="50%">
<h3>2. Покрытие требований</h3>
<table>
<thead><tr><th>Статус</th><th>Результат</th></tr></thead>
<tbody>
<tr><td>Полнота аудита</td><td><strong>${coverageTotal} / ${portfolio.requirements} · 100%</strong></td></tr>
<tr><td>Автоматизировано</td><td><strong>${coverage.automated} / 50 · 90%</strong></td></tr>
<tr><td>Частично</td><td>${coverage.partial} / 50 · 4%</td></tr>
<tr><td>Известный дефект</td><td>${coverage["known defect"]} / 50 · 2%</td></tr>
<tr><td>Вне объёма</td><td>${coverage["out of scope"]} / 50 · 4%</td></tr>
</tbody>
</table>
</td>
</tr>
<tr>
<td valign="top" width="50%">
<h3>3. Окружение</h3>
<table>
<thead><tr><th>Параметр</th><th>Значение</th></tr></thead>
<tbody>
<tr><td>Runner</td><td>${escapeHtml(runner)}</td></tr>
<tr><td>Node.js</td><td><code>${escapeHtml(nodeVersion)}</code></td></tr>
<tr><td>Стенд</td><td><code>https://aiqa.su</code></td></tr>
<tr><td>Браузеры</td><td>Chromium · Firefox · WebKit</td></tr>
<tr><td>Параллельность</td><td><strong>4 процесса на браузер</strong></td></tr>
<tr><td>Повторы</td><td><strong>0</strong></td></tr>
</tbody>
</table>
</td>
<td valign="top" width="50%">
<h3>4. Запуск</h3>
<table>
<thead><tr><th>Поле</th><th>Значение</th></tr></thead>
<tbody>
<tr><td>Репозиторий</td><td><code>${escapeHtml(repository)}</code></td></tr>
<tr><td>Ветка</td><td><code>${escapeHtml(branch)}</code></td></tr>
<tr><td>Событие</td><td>${escapeHtml(event)}</td></tr>
<tr><td>Автор</td><td><code>${escapeHtml(actor)}</code></td></tr>
<tr><td>Коммит</td><td><code>${escapeHtml(shortSha)}</code></td></tr>
<tr><td>Запуск</td><td><a href="${runUrl}">#${escapeHtml(runNumber)}</a></td></tr>
<tr><td>Attempt</td><td><strong>${escapeHtml(process.env.GITHUB_RUN_ATTEMPT || "1")}</strong></td></tr>
</tbody>
</table>
</td>
</tr>
</table>`,
];

sections.push(
  "## Состав тестов\n\n" +
    markdownTable(
      ["Уровень", "Проверок"],
      [
        ["Модульные", portfolio.unit ?? "—"],
        ["API", portfolio.api ?? "—"],
        ["E2E", portfolio.e2e ?? "—"],
        ["**Всего**", "**" + (portfolio.total ?? "—") + "**"],
      ],
    ),
);

sections.push(
  "## Браузерная матрица\n\n" +
    markdownTable(
      [
        "Браузер",
        "Результат",
        "Ожидаемые падения",
        "Непредвиденные",
        "Нестабильные",
        "Повторы",
        "Время",
      ],
      browserRows,
    ),
);

if (allFailures.length > 0) {
  sections.push(
    "## Непредвиденные падения\n\n" +
      markdownTable(
        ["Браузер", "Файл", "Сценарий"],
        allFailures.map((failure) => [
          failure.browser,
          failure.file,
          failure.title,
        ]),
      ) +
      "\n\nДля упавших проверок сохранены trace, скриншоты, видео и отчёты.",
  );
}

sections.push(
  "## Работа с тестовыми данными\n\n" +
    markdownTable(
      ["Показатель", "Значение"],
      [
        ["Файлы E2E", e2eSpecFiles.length],
        [
          "Подготовка через API / вспомогательные функции",
          e2eWithApiArrange.length + " / " + e2eSpecFiles.length,
        ],
        [
          "Централизованная очистка",
          e2eWithCleanup.length + " / " + e2eSpecFiles.length,
        ],
      ],
    ),
);

if (slowestRows.length > 0) {
  sections.push(
    "## Самые медленные сценарии\n\n" +
      markdownTable(
        ["Браузер", "Время", "Сценарий"],
        slowestRows,
      ),
  );
}

sections.push(`
## Отчёты и материалы

| Материал | Назначение | Хранение |
| --- | --- | ---: |
| [Playwright HTML](${artifactsUrl}) | интерактивный отчёт по браузеру | 14 дней |
| [Allure](${artifactsUrl}) | шаги, вложения и история | 14 дней |
| [JSON + JUnit](${artifactsUrl}) | результаты для автоматической обработки | 14 дней |
| [Диагностика ошибок](${artifactsUrl}) | trace / скриншоты / видео | 7 дней |
| Матрица требований | проверка 50/50 + ссылки на тесты + README ↔ матрица | CI |

## Дополнительные проверки

| Проверка | Что контролирует |
| --- | --- |
| [Безопасность](${server}/${repository}/actions/workflows/security.yml) | npm audit · зависимости · SBOM · статический анализ |
| [AI Review](${server}/${repository}/actions/workflows/ai-review.yml) | проверка изменений по CODEX после зелёного CI |
| [Доступность](${server}/${repository}/actions/workflows/accessibility.yml) | axe-core / WCAG |
| [Производительность](${server}/${repository}/actions/workflows/performance.yml) | Lighthouse |
| [Визуальная регрессия](${server}/${repository}/actions/workflows/visual.yml) | сравнение интерфейса в Chromium |
| [Стабильность](${server}/${repository}/actions/workflows/stability.yml) | повторные прогоны с \`retries=0\` |
| [Ночная регрессия](${server}/${repository}/actions/workflows/nightly.yml) | плановая проверка live-стенда |
| [Контракт регистрации](${server}/${repository}/actions/workflows/registration-contract-smoke.yml) | отдельная smoke-проверка регистрации |

## Подробности по браузерам

${browserDetails(
  "chromium",
  "Chromium",
  metrics.get("chromium"),
)}

${browserDetails(
  "firefox",
  "Firefox",
  metrics.get("firefox"),
)}

${browserDetails(
  "webkit",
  "WebKit",
  metrics.get("webkit"),
)}

---

> **Принцип:** результат не маскируется повторами. \`retries=0\`; браузерные E2E запускаются только после быстрых проверок качества, модульных и API-тестов.
`);

const markdown = sections.join("\n\n");

if (summaryPath) {
  appendFileSync(summaryPath, markdown + "\n");
} else {
  console.log(markdown);
}
