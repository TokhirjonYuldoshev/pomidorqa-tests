import assert from "node:assert/strict";

import {
  annotatePatch,
  findDeterministicFindings,
  findImpactedRequirements,
  mergeReviewFindings,
} from "./ai-review-lib.mjs";

function checkPatchAnnotation() {
  const patch = [
    "@@ -10,2 +10,4 @@",
    " context",
    "+await page.waitForTimeout(1000);",
    "+await button.click({ force: true });",
    " context",
  ].join("\n");

  const parsed = annotatePatch(patch);

  assert.deepEqual(
    [...parsed.addedLines],
    [11, 12],
  );

  assert.deepEqual(
    parsed.addedEntries,
    [
      {
        line: 11,
        text: "await page.waitForTimeout(1000);",
      },
      {
        line: 12,
        text: "await button.click({ force: true });",
      },
    ],
  );
}

function checkDeterministicPolicy() {
  const findings = findDeterministicFindings([
    {
      filename: "tests/e2e/example.spec.ts",
      addedEntries: [
        {
          line: 10,
          text: "await page.waitForTimeout(1000);",
        },
        {
          line: 11,
          text: "await button.click({ force: true });",
        },
        {
          line: 12,
          text: "test.only('focus', async () => {});",
        },
        {
          line: 13,
          text: "await page.pause();",
        },
      ],
    },
  ]);

  assert.equal(findings.length, 4);
  assert.ok(
    findings.every(
      (finding) =>
        finding.rule === "9" &&
        finding.priority === "P2",
    ),
  );

  const docsFindings =
    findDeterministicFindings([
      {
        filename: "docs/ai-review.md",
        addedEntries: [
          {
            line: 10,
            text: "Документ упоминает waitForTimeout и force: true.",
          },
        ],
      },
    ]);

  assert.equal(docsFindings.length, 0);
}

function checkRequirementTraceability() {
  const matrix = [
    "| ID | Требование | Статус | Доказательство |",
    "|---|---|---|---|",
    "| R10.4 | Гонка за слот | `automated` | `tests/e2e/booking-flow.spec.ts` |",
    "| R12.1 | Встречи участника | `automated` | `tests/e2e/booking-flow.spec.ts`, `tests/e2e/meetings.spec.ts` |",
    "| R5.1 | Имя обязательно | `automated` | `tests/e2e/profile-rules.spec.ts` |",
  ].join("\n");

  const impacted = findImpactedRequirements(
    matrix,
    ["tests/e2e/booking-flow.spec.ts"],
  );

  assert.deepEqual(
    impacted.map((item) => item.id),
    ["R10.4", "R12.1"],
  );
}

function checkFindingDeduplication() {
  const deterministic = [
    {
      path: "tests/e2e/example.spec.ts",
      line: 10,
      rule: "9",
      priority: "P2",
      title: "Первый finding",
      body: "Первый источник.",
    },
  ];

  const model = [
    {
      path: "tests/e2e/example.spec.ts",
      line: 10,
      rule: "9",
      priority: "P2",
      title: "Дубликат",
      body: "Второй источник.",
    },
    {
      path: "tests/e2e/example.spec.ts",
      line: 20,
      rule: "4",
      priority: "P3",
      title: "Другой finding",
      body: "Другая координата.",
    },
  ];

  const merged = mergeReviewFindings(
    deterministic,
    model,
    5,
  );

  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, "Первый finding");
  assert.equal(merged[1].line, 20);
}

checkPatchAnnotation();
checkDeterministicPolicy();
checkRequirementTraceability();
checkFindingDeduplication();

console.log("AI review policy self-check passed.");
