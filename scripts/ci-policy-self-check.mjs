import {
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";

const WORKFLOW_DIR = ".github/workflows";

function fail(message) {
  failures.push(message);
}

function requireText(text, needle, label) {
  if (!text.includes(needle)) {
    fail(`${label}: missing "${needle}"`);
  }
}

function stepBlock(text, name) {
  const marker = `      - name: ${name}`;
  const start = text.indexOf(marker);

  if (start === -1) {
    return "";
  }

  const next = text.indexOf(
    "\n      - name:",
    start + marker.length,
  );

  return text.slice(
    start,
    next === -1 ? text.length : next,
  );
}

const workflowFiles = readdirSync(
  WORKFLOW_DIR,
)
  .filter((name) => name.endsWith(".yml"))
  .sort();

const workflows = new Map(
  workflowFiles.map((name) => [
    name,
    readFileSync(
      join(WORKFLOW_DIR, name),
      "utf8",
    ),
  ]),
);

const failures = [];
let pinnedActionCount = 0;
let uploadCount = 0;

for (const [name, text] of workflows) {
  if (text.includes("pull_request_target:")) {
    fail(
      `${name}: pull_request_target is forbidden for this repository`,
    );
  }

  requireText(
    text,
    "Telegram",
    `${name} notification policy`,
  );

  const actionRefs = [
    ...text.matchAll(
      /^\s*uses:\s*([^\s#]+)/gm,
    ),
  ].map((match) => match[1]);

  for (const ref of actionRefs) {
    if (ref.startsWith("./")) {
      continue;
    }

    if (
      !/^[^@\s]+@[0-9a-f]{40}$/.test(
        ref,
      )
    ) {
      fail(
        `${name}: action is not pinned to a full commit SHA: ${ref}`,
      );
      continue;
    }

    pinnedActionCount += 1;
  }

  const lines = text.split("\n");

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    if (
      !lines[index].includes(
        "uses: actions/upload-artifact@",
      )
    ) {
      continue;
    }

    uploadCount += 1;

    const context = lines
      .slice(
        Math.max(0, index - 5),
        index + 1,
      )
      .join("\n");

    if (
      !context.includes(
        "continue-on-error: true",
      )
    ) {
      fail(
        `${name}:${index + 1}: diagnostic artifact upload must be non-blocking`,
      );
    }
  }

  if (
    /--retries=(?!0\b)\d+/.test(text)
  ) {
    fail(
      `${name}: positive Playwright retries are forbidden`,
    );
  }

  const allureBlocks = text
    .split(/(?=^\s{6}- name: )/gm)
    .filter((block) =>
      block.includes(
        "npm run allure:generate",
      ),
    );

  for (const block of allureBlocks) {
    if (
      !block.includes(
        "continue-on-error: true",
      )
    ) {
      fail(
        `${name}: Allure generation after the primary check must be non-blocking`,
      );
    }
  }
}

const playwright =
  workflows.get("playwright.yml") ?? "";

requireText(
  playwright,
  "fail-fast: false",
  "playwright matrix",
);
requireText(
  playwright,
  "max-parallel: 2",
  "playwright matrix",
);
requireText(
  playwright,
  "--workers=4 --retries=0",
  "playwright E2E",
);
requireText(
  playwright,
  "browser: chromium",
  "playwright matrix",
);
requireText(
  playwright,
  "browser: firefox",
  "playwright matrix",
);
requireText(
  playwright,
  "browser: webkit",
  "playwright matrix",
);
requireText(
  playwright,
  "name: Regression Gate",
  "playwright gate",
);
requireText(
  playwright,
  "name: CI Summary",
  "playwright summary",
);
requireText(
  playwright,
  "name: Telegram Notification",
  "playwright notification",
);

const mainE2eStep = stepBlock(
  playwright,
  "Run E2E tests",
);

if (
  !mainE2eStep ||
  mainE2eStep.includes(
    "continue-on-error: true",
  )
) {
  fail(
    "playwright.yml: Run E2E tests must remain blocking",
  );
}

const nightly =
  workflows.get("nightly.yml") ?? "";

requireText(
  nightly,
  "--workers=1 --retries=0",
  "nightly E2E",
);
requireText(
  nightly,
  "nightly-machine-report-",
  "nightly diagnostics",
);

const stability =
  workflows.get("stability.yml") ?? "";

requireText(
  stability,
  "--retries=0",
  "stability E2E",
);
requireText(
  stability,
  "id: stability_run",
  "stability outcome capture",
);
requireText(
  stability,
  "Fail workflow when stability check failed",
  "stability enforcement",
);
requireText(
  stability,
  "stability-machine-report-",
  "stability diagnostics",
);

const security =
  workflows.get("security.yml") ?? "";

requireText(
  security,
  "Enforce npm security evidence",
  "security enforcement",
);
requireText(
  security,
  "npm audit --audit-level=high --json",
  "security audit",
);

const aiReview =
  workflows.get("ai-review.yml") ?? "";

requireText(
  aiReview,
  "contents: read",
  "AI Review permissions",
);
requireText(
  aiReview,
  "pull-requests: write",
  "AI Review review permission",
);
requireText(
  aiReview,
  "ref: ${{ github.event.repository.default_branch }}",
  "AI Review trusted checkout",
);

if (workflowFiles.length !== 10) {
  fail(
    `Expected 10 custom workflows, found ${workflowFiles.length}`,
  );
}

if (failures.length > 0) {
  console.error(
    "CI policy self-check failed:",
  );

  for (const message of failures) {
    console.error(`- ${message}`);
  }

  process.exit(1);
}

console.log(
  [
    "CI policy self-check passed.",
    `workflows=${workflowFiles.length}`,
    `pinned_actions=${pinnedActionCount}`,
    `non_blocking_uploads=${uploadCount}`,
    "retries=0",
    "main_matrix_max_parallel=2",
  ].join(" "),
);
