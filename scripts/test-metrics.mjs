#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { join, normalize } from "node:path";

const reportPath = process.argv[2] ?? "test-results/results.json";
const testsDir = "tests";

function normalizePath(path) {
  return normalize(path).replaceAll("\\", "/");
}

function collectSpecs(suite, project, out) {
  const suiteProject = /^(unit|api|e2e)$/.test(suite.title ?? "")
    ? suite.title
    : project;

  for (const spec of suite.specs ?? []) {
    for (const currentTest of spec.tests ?? []) {
      const results = currentTest.results ?? [];

      out.push({
        title: spec.title,
        file: normalizePath(spec.file ?? ""),
        project: currentTest.projectName || suiteProject || "unknown",
        status: currentTest.status,
        expectedStatus: currentTest.expectedStatus,
        duration: results.reduce(
          (sum, result) => sum + (result.duration ?? 0),
          0,
        ),
        attempts: results.length,
      });
    }
  }

  for (const child of suite.suites ?? []) {
    collectSpecs(child, suiteProject, out);
  }
}

function listSpecFiles(dir) {
  const files = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listSpecFiles(path));
    } else if (entry.name.endsWith(".spec.ts")) {
      files.push(normalizePath(path));
    }
  }

  return files;
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)} с`;
}

function table(rows) {
  const widths = rows[0].map((_, index) =>
    Math.max(...rows.map((row) => String(row[index]).length)),
  );

  return rows
    .map((row) =>
      row
        .map((cell, index) =>
          String(cell).padEnd(widths[index]),
        )
        .join("  "),
    )
    .join("\n");
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const tests = [];

for (const suite of report.suites ?? []) {
  collectSpecs(suite, null, tests);
}

if (tests.length === 0) {
  console.error(`В отчёте ${reportPath} не найдено тестов`);
  process.exit(1);
}

const expectedFailures = tests.filter(
  (currentTest) => currentTest.expectedStatus === "failed",
);
const unexpected = tests.filter(
  (currentTest) => currentTest.status === "unexpected",
);
const flaky = tests.filter(
  (currentTest) => currentTest.status === "flaky",
);
const skipped = tests.filter(
  (currentTest) => currentTest.status === "skipped",
);
const retried = tests.filter(
  (currentTest) => currentTest.attempts > 1,
);
const wallClock =
  report.stats?.duration ??
  tests.reduce((sum, currentTest) => sum + currentTest.duration, 0);

const byProject = new Map();

for (const currentTest of tests) {
  const bucket = byProject.get(currentTest.project) ?? {
    count: 0,
    duration: 0,
  };

  bucket.count += 1;
  bucket.duration += currentTest.duration;
  byProject.set(currentTest.project, bucket);
}

const specFiles = listSpecFiles(testsDir);
const e2eFiles = specFiles.filter((file) => file.includes("/e2e/"));
const withApiArrange = e2eFiles.filter((file) => {
  const source = readFileSync(file, "utf8");

  return [
    "registerUserViaApi",
    "prepareCatalogParticipant",
    "prepareCatalogParticipantWithSkills",
    "registerWithSkill",
  ].some((marker) => source.includes(marker));
});
const withCentralizedCleanup = e2eFiles.filter((file) => {
  const source = readFileSync(file, "utf8");

  return (
    source.includes("../fixtures/app-fixtures") ||
    source.includes("deleteUserViaApi")
  );
});

const slowest = [...tests]
  .sort((left, right) => right.duration - left.duration)
  .slice(0, 5);

console.log("Метрики прогона\n");
console.log(
  table([
    ["Всего тестов", tests.length],
    [
      "Прошли как ожидалось",
      tests.length - unexpected.length - flaky.length - skipped.length,
    ],
    ["Ожидаемые падения", expectedFailures.length],
    ["Непредвиденные падения", unexpected.length],
    ["Flaky", flaky.length],
    ["Пропущены", skipped.length],
    ["Тестов с повторами", retried.length],
    ["Общее время", formatSeconds(wallClock)],
  ]),
);

console.log("\nПо уровням\n");
console.log(
  table([
    ["Уровень", "Тестов", "Время"],
    ...[...byProject.entries()]
      .sort((left, right) => right[1].count - left[1].count)
      .map(([project, bucket]) => [
        project,
        bucket.count,
        formatSeconds(bucket.duration),
      ]),
  ]),
);

console.log("\nДисциплина E2E\n");
console.log(
  table([
    ["Файлов E2E", e2eFiles.length],
    [
      "API/Helper Arrange",
      `${withApiArrange.length} из ${e2eFiles.length}`,
    ],
    [
      "Централизованный cleanup",
      `${withCentralizedCleanup.length} из ${e2eFiles.length}`,
    ],
  ]),
);

console.log("\nСамые медленные сценарии\n");
console.log(
  table(
    slowest.map((currentTest) => [
      formatSeconds(currentTest.duration),
      currentTest.project,
      currentTest.title,
    ]),
  ),
);

if (unexpected.length > 0) {
  console.log("\nНепредвиденные падения\n");
  console.log(
    table(
      unexpected.map((currentTest) => [
        currentTest.project,
        currentTest.file,
        currentTest.title,
      ]),
    ),
  );
}

process.exit(unexpected.length > 0 ? 1 : 0);
