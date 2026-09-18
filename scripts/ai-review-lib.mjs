const REVIEWED_EXACT_PATHS = new Set([
  "eslint.config.mjs",
  "package.json",
  "playwright.config.ts",
  "playwright.visual.config.ts",
]);

export const REVIEW_MARKER_PREFIX = "<!-- pomidorqa-gemini-review:";

function sanitizeReviewText(value) {
  return String(value ?? "")
    .trim()
    .replaceAll("@", "@\u200b");
}

export function isReviewedPath(path) {
  return path.startsWith("tests/") || REVIEWED_EXACT_PATHS.has(path);
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
      addedLines.add(newLine);
      annotated.push(`+${newLine}: ${rawLine.slice(1)}`);
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
  };
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
