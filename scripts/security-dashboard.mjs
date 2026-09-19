#!/usr/bin/env node

import {
  appendFileSync,
  existsSync,
  readFileSync,
} from "node:fs";

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
const auditPath =
  process.argv[2] ?? ".qa-artifacts/security/npm-audit.json";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
      return "⏭️ Не требовалось";
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

function readVulnerabilities(path) {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const report = JSON.parse(
      readFileSync(path, "utf8"),
    );

    return report.metadata?.vulnerabilities ?? null;
  } catch (error) {
    console.warn(
      "Не удалось разобрать npm audit: " +
        error.message,
    );

    return null;
  }
}

const audit = process.env.AUDIT || "unknown";
const dependencies =
  process.env.DEPENDENCIES || "unknown";
const quality = process.env.QUALITY || "unknown";
const counts = readVulnerabilities(auditPath);

const hasFailure = [
  audit,
  dependencies,
  quality,
].includes("failure");
const hasCancelled = [
  audit,
  dependencies,
  quality,
].includes("cancelled");
const dependencyAcceptable =
  dependencies === "success" ||
  dependencies === "skipped";

let overall = "⚠️ ПРОВЕРКА ЗАВЕРШЕНА НЕ ПОЛНОСТЬЮ";
let note =
  "Часть сигналов безопасности отсутствует или была пропущена.";

if (
  audit === "success" &&
  quality === "success" &&
  dependencyAcceptable
) {
  overall = "✅ БЕЗОПАСНОСТЬ И КАЧЕСТВО ПРОВЕРЕНЫ";
  note =
    "Обязательные проверки завершились успешно.";
} else if (hasFailure) {
  overall = "❌ ТРЕБУЕТСЯ ВНИМАНИЕ";
  note =
    "Одна или несколько обязательных проверок завершились с ошибкой.";
} else if (hasCancelled) {
  overall = "⏹️ ПРОВЕРКА ОТМЕНЕНА";
  note =
    "Выполнение проверок безопасности было остановлено.";
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

const valueOrDash = (value) =>
  value === null || value === undefined
    ? "—"
    : String(value);

const critical = counts?.critical;
const high = counts?.high;
const moderate = counts?.moderate;
const low = counts?.low;
const info = counts?.info;
const total = counts?.total;

const markdown = `
# Безопасность и качество

_Проверка зависимостей, цепочки поставки и статического качества_

## ${overall}

> ${note}

<p><a href="${runUrl}">Открыть запуск</a> · <a href="${artifactsUrl}">Материалы проверки</a> · <a href="https://t.me/Tokhirjon_QA_Bot">Telegram</a></p>

---

<table>
<tr>
<td valign="top" width="50%">
<h3>1. Проверки</h3>
<table>
<thead><tr><th>Проверка</th><th>Статус</th></tr></thead>
<tbody>
<tr><td>npm audit + CycloneDX SBOM</td><td>${escapeHtml(statusLabel(audit))}</td></tr>
<tr><td>Изменения зависимостей</td><td>${escapeHtml(statusLabel(dependencies))}</td></tr>
<tr><td>ESLint + TypeScript</td><td>${escapeHtml(statusLabel(quality))}</td></tr>
</tbody>
</table>
</td>
<td valign="top" width="50%">
<h3>2. Найденные уязвимости</h3>
<table>
<thead><tr><th>Уровень</th><th>Количество</th></tr></thead>
<tbody>
<tr><td>Критические</td><td><strong>${valueOrDash(critical)}</strong></td></tr>
<tr><td>Высокие</td><td><strong>${valueOrDash(high)}</strong></td></tr>
<tr><td>Средние</td><td>${valueOrDash(moderate)}</td></tr>
<tr><td>Низкие</td><td>${valueOrDash(low)}</td></tr>
<tr><td>Информационные</td><td>${valueOrDash(info)}</td></tr>
<tr><td><strong>Всего</strong></td><td><strong>${valueOrDash(total)}</strong></td></tr>
</tbody>
</table>
</td>
</tr>
<tr>
<td valign="top" width="50%">
<h3>3. Материалы и политика</h3>
<table>
<thead><tr><th>Параметр</th><th>Значение</th></tr></thead>
<tbody>
<tr><td>Порог блокировки</td><td><strong>high / critical</strong></td></tr>
<tr><td>npm audit JSON</td><td><a href="${artifactsUrl}">Открыть artifact</a></td></tr>
<tr><td>CycloneDX SBOM</td><td><a href="${artifactsUrl}">Открыть artifact</a></td></tr>
<tr><td>Хранение</td><td>14 дней</td></tr>
<tr><td>Runner</td><td>${escapeHtml(runner)}</td></tr>
<tr><td>Node.js</td><td><code>${escapeHtml(nodeVersion)}</code></td></tr>
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
</tbody>
</table>
</td>
</tr>
</table>

---

> **Контроль:** high/critical блокируют проверку. Более низкие уровни остаются видимыми в материалах и не скрываются.
`;

if (summaryPath) {
  appendFileSync(summaryPath, markdown);
} else {
  console.log(markdown);
}
