import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.POMIDORQA_BASE_URL ?? "https://aiqa.su";
const axePath = process.env.AXE_SOURCE_PATH ?? ".qa-artifacts/axe.min.js";
const enforce = process.env.ACCESSIBILITY_ENFORCE === "true";
const reportDir = ".qa-artifacts/accessibility";

const targets = [
  { name: "catalog", route: "/pomidorqa" },
  { name: "login", route: "/pomidorqa/auth/login" },
  { name: "register", route: "/pomidorqa/auth/register" },
];

const blockingImpacts = new Set(["critical", "serious"]);
const axeSource = await readFile(axePath, "utf8");
await mkdir(reportDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const summaryRows = [];
let blockingCount = 0;

try {
  for (const target of targets) {
    const page = await browser.newPage();
    const url = new URL(target.route, baseURL).toString();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    await page.addScriptTag({ content: axeSource });

    const result = await page.evaluate(async () => {
      return globalThis.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      });
    });

    const blocking = result.violations.filter((violation) =>
      blockingImpacts.has(violation.impact),
    );

    blockingCount += blocking.length;
    summaryRows.push({
      page: target.name,
      violations: result.violations.length,
      blocking: blocking.length,
      incomplete: result.incomplete.length,
    });

    await writeFile(
      path.join(reportDir, `${target.name}.json`),
      JSON.stringify({ url, ...result }, null, 2),
      "utf8",
    );

    await page.close();
  }
} finally {
  await browser.close();
}

const markdown = [
  "## ♿ Accessibility Audit",
  "",
  `Mode: **${enforce ? "enforced" : "informational"}**`,
  "",
  "| Page | Violations | Serious/Critical | Incomplete |",
  "| --- | ---: | ---: | ---: |",
  ...summaryRows.map(
    (row) =>
      `| ${row.page} | ${row.violations} | ${row.blocking} | ${row.incomplete} |`,
  ),
  "",
  `Serious/Critical violations: **${blockingCount}**`,
  "",
  enforce
    ? "Serious or critical WCAG violations fail the workflow in enforced mode."
    : "Audit is informational by default; use workflow_dispatch with enforcement enabled to turn serious/critical violations into a failing gate.",
  "",
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
}

console.log(markdown);

if (enforce && blockingCount > 0) {
  console.error(`Accessibility gate failed: ${blockingCount} serious/critical violation(s).`);
  process.exitCode = 1;
}
