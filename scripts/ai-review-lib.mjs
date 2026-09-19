const REVIEWED_EXACT_PATHS = new Set([
  "CODEX.md",
  "README.md",
  "REVIEW.md",
  "eslint.config.mjs",
  "package.json",
  "playwright.config.ts",
  "playwright.visual.config.ts",
  "requirements.md",
]);

const REVIEWED_PREFIXES = [
  ".github/workflows/",
  "docs/",
  "scripts/",
  "src/",
  "tests/",
];

export const REVIEW_MARKER_PREFIX = "<!-- pomidorqa-gemini-review:";

function sanitizeReviewText(value) {
  return String(value ?? "")
    .trim()
    .replaceAll("@", "@\u200b");
}

export function isReviewedPath(path) {
  return (
    REVIEWED_EXACT_PATHS.has(path) ||
    REVIEWED_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

export function extractRuleNumbers(markdown) {
  return [
    ...new Set(
      [...String(markdown).matchAll(/^##\s+(\d+)\./gm)].map(
        (match) => match[1],
      ),
    ),
  ];
}

export function annotatePatch(patch) {
  const addedLines = new Set();
  const addedEntries = [];
  const annotated = [];
  let newLine = 0;

  for (const rawLine of String(patch).split("\n")) {
    const hunk = rawLine.match(
      /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/,
    );

    if (hunk) {
      newLine = Number(hunk[1]);
      annotated.push(rawLine);
      continue;
    }

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      const text = rawLine.slice(1);

      addedLines.add(newLine);
      addedEntries.push({
        line: newLine,
        text,
      });
      annotated.push(`+${newLine}: ${text}`);
      newLine += 1;
      continue;
    }

    if (rawLine.startsWith("-") && !rawLine.startsWith("---")) {
      continue;
    }

    if (!rawLine.startsWith("\\")) {
      annotated.push(` ${newLine}: ${rawLine.slice(1)}`);
      newLine += 1;
    }
  }

  return {
    annotated: annotated.join("\n"),
    addedLines,
    addedEntries,
  };
}

const DETERMINISTIC_RULES = [
  {
    pattern: /\bwaitForTimeout\s*\(/,
    rule: "9",
    priority: "P2",
    title: "Запрещён waitForTimeout",
    body:
      "Кодекс 9 запрещает waitForTimeout как способ синхронизации. Используй наблюдаемый сигнал: response, URL, состояние UI или auto-waiting.",
  },
  {
    pattern: /\bforce\s*:\s*true\b/,
    rule: "9",
    priority: "P2",
    title: "Запрещён force: true",
    body:
      "Кодекс 9 запрещает force: true. Причину недоступности элемента нужно синхронизировать через состояние интерфейса, а не обходить действие Playwright.",
  },
  {
    pattern: /\b(?:test|describe)\.only\s*\(/,
    rule: "9",
    priority: "P2",
    title: "Оставлен .only",
    body:
      "Кодекс 9 запрещает .only: он исключает часть набора из обычного прогона и делает сигнал CI неполным.",
  },
  {
    pattern: /\bpage\.pause\s*\(/,
    rule: "9",
    priority: "P2",
    title: "Оставлен page.pause()",
    body:
      "Кодекс 9 запрещает page.pause() в готовом тесте. Отладочный вызов нужно удалить до PR.",
  },
];

export function findDeterministicFindings(preparedFiles) {
  const findings = [];

  for (const file of preparedFiles) {
    for (const entry of file.addedEntries ?? []) {
      for (const rule of DETERMINISTIC_RULES) {
        if (!rule.pattern.test(entry.text)) {
          continue;
        }

        findings.push({
          path: file.filename,
          line: entry.line,
          priority: rule.priority,
          rule: rule.rule,
          title: rule.title,
          body: rule.body,
          source: "deterministic",
        });
      }
    }
  }

  return findings;
}

export function findImpactedRequirements(matrixMarkdown, changedPaths) {
  const paths = new Set(changedPaths);
  const requirements = [];

  for (const line of String(matrixMarkdown).split("\n")) {
    const match = line.match(
      /^\|\s*(R\d+\.\d+)\s*\|\s*([^|]+?)\s*\|\s*(?:\*\*)?`([^\`]+)`(?:\*\*)?\s*\|\s*(.*?)\s*\|$/,
    );

    if (!match) {
      continue;
    }

    const [, id, requirement, status, evidence] = match;
    const evidencePaths = [
      ...evidence.matchAll(/`([^\`]+\.(?:spec\.ts|md|mjs|ts))`/g),
    ].map((item) => item[1]);

    if (!evidencePaths.some((path) => paths.has(path))) {
      continue;
    }

    requirements.push({
      id,
      requirement: requirement.trim(),
      status: status.trim(),
    });
  }

  return requirements;
}

export function mergeReviewFindings(primary, secondary, maxItems = 5) {
  const seen = new Set();
  const merged = [];

  for (const finding of [...primary, ...secondary]) {
    const key = [
      finding.path,
      finding.line,
      finding.rule,
      finding.title,
    ].join(":");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(finding);

    if (merged.length >= maxItems) {
      break;
    }
  }

  return merged;
}

export function parseStructuredReview(content) {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Gemini вернул пустой ответ.");
  }

  let review;

  try {
    review = JSON.parse(content);
  } catch (error) {
    throw new Error(`Gemini вернул невалидный JSON: ${error.message}`);
  }

  if (!review || typeof review !== "object") {
    throw new Error("Gemini вернул не объект review.");
  }

  if (!Array.isArray(review.comments) || review.comments.length > 5) {
    throw new Error("Gemini вернул недопустимый список комментариев.");
  }

  for (const [index, comment] of review.comments.entries()) {
    if (!comment || typeof comment !== "object") {
      throw new Error(`Комментарий #${index} имеет неверный формат.`);
    }

    if (
      typeof comment.path !== "string" ||
      !Number.isInteger(comment.line) ||
      !["P1", "P2", "P3"].includes(comment.priority) ||
      !/^\d{1,2}$/.test(String(comment.rule)) ||
      typeof comment.title !== "string" ||
      typeof comment.body !== "string"
    ) {
      throw new Error(`Комментарий #${index} не прошёл локальную валидацию.`);
    }
  }

  return review;
}

export function buildReviewConclusion(comments) {
  if (!comments.length) {
    return [
      "**Итог: доказуемых нарушений CODEX.md не найдено.**",
      "CI завершился успешно, второй проход не подтвердил замечаний к добавленным строкам.",
    ].join(" ");
  }

  const blocking = comments.some((comment) =>
    ["P1", "P2"].includes(comment.priority),
  );

  const header = blocking
    ? "**Итог: требуется доработка.**"
    : "**Итог: есть неблокирующие замечания.**";

  const findings = comments
    .map(
      (comment) =>
        `- ${comment.priority} · Кодекс ${comment.rule}: ${sanitizeReviewText(comment.title)}`,
    )
    .join("\n");

  return `${header} Найдено подтверждённых замечаний: ${comments.length}.\n\n${findings}`;
}

export function toGitHubComments(
  comments,
  addedLinesByPath,
  allowedRuleNumbers,
) {
  const priorities = new Set(["P1", "P2", "P3"]);
  const allowedRules = new Set(allowedRuleNumbers.map(String));

  const selfNegating =
    /(?:не является нарушением|это (?:нормально|допустимо)|по кодексу .* допустимо|замечание не заводится|можно оставить как есть)/i;

  return comments.flatMap((comment) => {
    const line = Number(comment?.line);
    const text = `${comment?.title ?? ""} ${comment?.body ?? ""}`;

    const valid =
      comment &&
      typeof comment.path === "string" &&
      addedLinesByPath.get(comment.path)?.has(line) &&
      priorities.has(comment.priority) &&
      allowedRules.has(String(comment.rule)) &&
      typeof comment.title === "string" &&
      comment.title.trim() &&
      typeof comment.body === "string" &&
      comment.body.trim() &&
      !selfNegating.test(text);

    if (!valid) return [];

    return [
      {
        path: comment.path,
        line,
        side: "RIGHT",
        body:
          `**${comment.priority}: ${sanitizeReviewText(comment.title)}**` +
          ` · Кодекс ${comment.rule}\n\n${sanitizeReviewText(comment.body)}`,
      },
    ];
  });
}

export function reviewMarker(headSha) {
  return `${REVIEW_MARKER_PREFIX}${headSha} -->`;
}

export function hasReviewForCommit(reviews, headSha) {
  const marker = reviewMarker(headSha);
  return reviews.some((review) => review.body?.includes(marker));
}
