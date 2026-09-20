#!/usr/bin/env node

import { appendFileSync, existsSync, readFileSync } from "node:fs";

const matrixPath = "docs/coverage-matrix.md";
const readmePath = "README.md";
const summaryMode = process.argv.includes("--github-summary");

const allowedStatuses = [
  "automated",
  "partial",
  "known defect",
  "out of scope",
];

const expectedRequirementIds = new Set([
  ...Array.from({ length: 9 }, (_, index) => "R3." + (index + 1)),
  ...Array.from({ length: 6 }, (_, index) => "R4." + (index + 1)),
  ...Array.from({ length: 6 }, (_, index) => "R5." + (index + 1)),
  ...Array.from({ length: 6 }, (_, index) => "R6." + (index + 1)),
  ...Array.from({ length: 5 }, (_, index) => "R7." + (index + 1)),
  ...Array.from({ length: 4 }, (_, index) => "R8." + (index + 1)),
  ...Array.from({ length: 3 }, (_, index) => "R9." + (index + 1)),
  ...Array.from({ length: 5 }, (_, index) => "R10." + (index + 1)),
  ...Array.from({ length: 3 }, (_, index) => "R11." + (index + 1)),
  ...Array.from({ length: 3 }, (_, index) => "R12." + (index + 1)),
]);

function fail(message) {
  console.error("Coverage matrix validation failed: " + message);
  process.exit(1);
}

function percentage(count, total) {
  return Math.round((count / total) * 100) + "%";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTestCaseRefs(evidence) {
  return [...evidence.matchAll(
    /`(tests\/[^\`]+\.spec\.ts)`\s*→\s*`([^\`]+)`/g,
  )].map((match) => ({
    path: match[1],
    title: match[2],
  }));
}

function extractReadmeCount(readme, label) {
  const escaped = escapeRegExp(label);
  const pattern =
    "^\\|\\s*\\`" +
    escaped +
    "\\`\\s*\\|\\s*(?:\\*\\*)?(\\d+)\\s*\\/\\s*50" +
    "\\s*\\((\\d+)%\\)(?:\\*\\*)?\\s*\\|$";
  const match = readme.match(new RegExp(pattern, "m"));

  if (!match) {
    fail("README не содержит метрику " + label);
  }

  return {
    count: Number(match[1]),
    percent: Number(match[2]),
  };
}

function extractMatrixSummaryCount(matrix, label) {
  const escaped = escapeRegExp(label);
  const pattern =
    "^\\|\\s*\\`" +
    escaped +
    "\\`\\s*\\|\\s*(?:\\*\\*)?(\\d+)(?:\\*\\*)?" +
    "\\s*\\|\\s*(?:\\*\\*)?(\\d+)%(?:\\*\\*)?\\s*\\|$";
  const match = matrix.match(new RegExp(pattern, "m"));

  if (!match) {
    fail("coverage-matrix не содержит summary для " + label);
  }

  return {
    count: Number(match[1]),
    percent: Number(match[2]),
  };
}

const matrix = readFileSync(matrixPath, "utf8");
const readme = readFileSync(readmePath, "utf8");
const rows = [];
const rowPattern =
  /^\|\s*(R\d+\.\d+)\s*\|\s*([^|]+?)\s*\|\s*(?:\*\*)?`(automated|partial|known defect|out of scope)`(?:\*\*)?\s*\|\s*(.*?)\s*\|$/gm;

for (const match of matrix.matchAll(rowPattern)) {
  rows.push({
    id: match[1],
    requirement: match[2].trim(),
    status: match[3],
    evidence: match[4].trim(),
  });
}

if (rows.length !== 50) {
  fail("ожидалось 50 требований, найдено " + rows.length);
}

const ids = new Set();

for (const row of rows) {
  if (ids.has(row.id)) {
    fail("дублируется " + row.id);
  }

  ids.add(row.id);

  if (!allowedStatuses.includes(row.status)) {
    fail("неизвестный статус у " + row.id + ": " + row.status);
  }

  const caseRefs = extractTestCaseRefs(row.evidence);

  if (row.status !== "out of scope" && caseRefs.length === 0) {
    fail(
      row.id +
        " имеет статус " +
        row.status +
        ", но не содержит точную ссылку test-файл → test case",
    );
  }

  for (const caseRef of caseRefs) {
    if (!existsSync(caseRef.path)) {
      fail(
        row.id +
          " ссылается на отсутствующий test-файл " +
          caseRef.path,
      );
    }

    const testSource = readFileSync(caseRef.path, "utf8");

    if (!testSource.includes(caseRef.title)) {
      fail(
        row.id +
          " ссылается на отсутствующий test case \"" +
          caseRef.title +
          "\" в " +
          caseRef.path,
      );
    }
  }
}

for (const id of expectedRequirementIds) {
  if (!ids.has(id)) {
    fail("отсутствует " + id);
  }
}

for (const id of ids) {
  if (!expectedRequirementIds.has(id)) {
    fail("неожиданный requirement ID: " + id);
  }
}

const referencedTests = new Set(
  [...matrix.matchAll(/`(tests\/[^\`]+\.spec\.ts)`/g)].map(
    (match) => match[1],
  ),
);

const concreteCaseRefs = rows.flatMap((row) =>
  extractTestCaseRefs(row.evidence).map((caseRef) => ({
    requirementId: row.id,
    ...caseRef,
  })),
);

const uniqueConcreteCaseRefs = new Set(
  concreteCaseRefs.map(
    (caseRef) => caseRef.path + "::" + caseRef.title,
  ),
);

for (const path of referencedTests) {
  if (!existsSync(path)) {
    fail("матрица ссылается на отсутствующий файл " + path);
  }
}

const counts = Object.fromEntries(
  allowedStatuses.map((status) => [
    status,
    rows.filter((row) => row.status === status).length,
  ]),
);

const auditMatch = readme.match(
  /^\|\s*Полнота аудита\s*\|\s*\*\*(\d+)\s*\/\s*50\s*\((\d+)%\)\*\*\s*\|$/m,
);

if (
  !auditMatch ||
  Number(auditMatch[1]) !== 50 ||
  Number(auditMatch[2]) !== 100
) {
  fail("README должен фиксировать полноту аудита 50 / 50 (100%)");
}

for (const status of allowedStatuses) {
  const readmeMetric = extractReadmeCount(readme, status);
  const matrixMetric = extractMatrixSummaryCount(matrix, status);
  const expectedPercent = Math.round((counts[status] / 50) * 100);

  if (
    matrixMetric.count !== counts[status] ||
    matrixMetric.percent !== expectedPercent
  ) {
    fail(
      "summary matrix расходится с requirement rows по " +
        status +
        ": rows=" +
        counts[status] +
        " (" +
        expectedPercent +
        "%), summary=" +
        matrixMetric.count +
        " (" +
        matrixMetric.percent +
        "%)",
    );
  }

  if (
    readmeMetric.count !== counts[status] ||
    readmeMetric.percent !== expectedPercent
  ) {
    fail(
      "README и matrix расходятся по " +
        status +
        ": matrix=" +
        counts[status] +
        " (" +
        expectedPercent +
        "%), README=" +
        readmeMetric.count +
        " (" +
        readmeMetric.percent +
        "%)",
    );
  }
}

const total = Object.values(counts).reduce(
  (sum, value) => sum + value,
  0,
);

if (total !== 50) {
  fail("сумма статусов должна быть 50, получено " + total);
}

const summary = [
  "## Requirement coverage",
  "",
  "| Статус | Требований | Доля |",
  "| --- | ---: | ---: |",
  "| automated | " +
    counts.automated +
    " | " +
    percentage(counts.automated, 50) +
    " |",
  "| partial | " +
    counts.partial +
    " | " +
    percentage(counts.partial, 50) +
    " |",
  "| known defect | " +
    counts["known defect"] +
    " | " +
    percentage(counts["known defect"], 50) +
    " |",
  "| out of scope | " +
    counts["out of scope"] +
    " | " +
    percentage(counts["out of scope"], 50) +
    " |",
  "| **Всего** | **50** | **100%** |",
  "",
  "### Traceability",
  "",
  "| Проверка | Результат |",
  "| --- | ---: |",
  "| Requirement IDs | **50 / 50** |",
  "| Уникальных test-файлов в матрице | **" +
    referencedTests.size +
    "** |",
  "| Уникальных точных test-case ссылок | **" +
    uniqueConcreteCaseRefs.size +
    "** |",
  "| Невалидных test-case ссылок | **0** |",
  "| Отсутствующих test-файлов | **0** |",
  "| README ↔ matrix | **синхронизированы** |",
  "",
].join("\n");

console.log(
  "Coverage matrix OK: 50/50; automated=" +
    counts.automated +
    "; partial=" +
    counts.partial +
    "; known defect=" +
    counts["known defect"] +
    "; out of scope=" +
    counts["out of scope"] +
    "; test refs=" +
    referencedTests.size +
    "; case refs=" +
    uniqueConcreteCaseRefs.size,
);

if (summaryMode && process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
}
