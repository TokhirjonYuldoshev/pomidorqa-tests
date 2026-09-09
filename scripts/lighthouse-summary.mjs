import { appendFile, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const reportDir = process.argv[2] ?? ".qa-artifacts/lighthouse";
const enforce = process.env.LIGHTHOUSE_ENFORCE === "true";
const thresholds = {
  performance: 0.5,
  accessibility: 0.8,
  "best-practices": 0.8,
  seo: 0.8,
};

const files = (await readdir(reportDir))
  .filter((file) => file.endsWith(".json"))
  .sort();

if (files.length === 0) {
  throw new Error(`No Lighthouse JSON reports found in ${reportDir}`);
}

const rows = [];
const failures = [];

for (const file of files) {
  const report = JSON.parse(await readFile(path.join(reportDir, file), "utf8"));
  const name = path.basename(file, ".json");
  const scores = Object.fromEntries(
    Object.keys(thresholds).map((category) => [
      category,
      report.categories?.[category]?.score ?? null,
    ]),
  );

  rows.push({ name, ...scores });

  for (const [category, threshold] of Object.entries(thresholds)) {
    const score = scores[category];
    if (score === null) {
      failures.push(`${name}: missing ${category} score`);
    } else if (score < threshold) {
      failures.push(
        `${name}: ${category} ${(score * 100).toFixed(0)} < ${(threshold * 100).toFixed(0)}`,
      );
    }
  }
}

const pct = (score) => (score === null ? "n/a" : `${Math.round(score * 100)}`);
const markdown = [
  "## 🚦 Performance Smoke / Lighthouse",
  "",
  `Mode: **${enforce ? "enforced" : "informational"}**`,
  "",
  "| Page | Performance | Accessibility | Best Practices | SEO |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...rows.map(
    (row) =>
      `| ${row.name} | ${pct(row.performance)} | ${pct(row.accessibility)} | ${pct(row["best-practices"])} | ${pct(row.seo)} |`,
  ),
  "",
  failures.length > 0
    ? `Budget findings: **${failures.length}**\n\n${failures.map((item) => `- ${item}`).join("\n")}`
    : "All configured Lighthouse budgets are satisfied.",
  "",
  enforce
    ? "Scores below the configured smoke budgets fail the workflow in enforced mode."
    : "Budgets are informational by default; workflow_dispatch can enable enforcement.",
  "",
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
}

console.log(markdown);

if (enforce && failures.length > 0) {
  process.exitCode = 1;
}
