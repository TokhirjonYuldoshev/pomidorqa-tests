import {
  readFileSync,
} from "node:fs";
import {
  execFileSync,
} from "node:child_process";

const SOURCE_REPOSITORY =
  "lebed52/pomidorqa-course-tests";

const forbiddenPatterns = [
  {
    label: "homework marker",
    pattern: /\bhw\d+\b/i,
  },
  {
    label: "lesson framing",
    pattern: /\bурок\w*/i,
  },
  {
    label: "course framing",
    pattern: /\bкурс\w*/i,
  },
  {
    label: "study framing",
    pattern: /\bучеб\w*/i,
  },
  {
    label: "marathon framing",
    pattern: /\bмарафон\w*/i,
  },
  {
    label: "homework wording",
    pattern: /\bдомашн\w*/i,
  },
  {
    label: "training wording",
    pattern: /\btraining\b/i,
  },
  {
    label: "student wording",
    pattern: /\bstudent\b/i,
  },
  {
    label: "mentor wording",
    pattern: /\bmentor\b/i,
  },
  {
    label: "portfolio framing",
    pattern: /\bportfolio\b/i,
  },
  {
    label: "portfolio framing",
    pattern: /\bпортфельн\w*/i,
  },
  {
    label: "QA Senior role label",
    pattern:
      /\b(?:qa\s*senior|senior\s*qa|qasenior)\b/i,
  },
  {
    label: "QA Lead role label",
    pattern:
      /\b(?:qa\s*lead|lead\s*qa|qalead|qa[- ]?лид)\b/i,
  },
];

const trackedFiles = execFileSync(
  "git",
  ["ls-files", "-z"],
)
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

const failures = [];
let sourceRepositoryOccurrences = 0;

for (const path of trackedFiles) {
  const buffer = readFileSync(path);

  if (buffer.includes(0)) {
    continue;
  }

  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const sourceMatches =
      line.match(
        /lebed52\/pomidorqa-course-tests/g,
      ) ?? [];

    sourceRepositoryOccurrences +=
      sourceMatches.length;

    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(line)) {
        failures.push(
          `${path}:${index + 1}: ${rule.label}: ${line.trim()}`,
        );
      }
    }
  });
}

const readme = readFileSync(
  "README.md",
  "utf8",
);

const originHeading =
  "## Происхождение кода и вклад";

const originIndex =
  readme.indexOf(originHeading);

const sourceIndex =
  readme.indexOf(SOURCE_REPOSITORY);

if (originIndex === -1) {
  failures.push(
    "README.md: missing origin section",
  );
}

if (
  sourceRepositoryOccurrences !== 2
) {
  failures.push(
    `Expected the source repository slug exactly twice in README markdown link text+URL, found ${sourceRepositoryOccurrences}`,
  );
}

if (
  sourceIndex === -1 ||
  sourceIndex < originIndex
) {
  failures.push(
    "README.md: source repository must appear only in the origin section",
  );
}

const textAfterOrigin =
  originIndex === -1
    ? ""
    : readme.slice(originIndex);

if (
  !textAfterOrigin.includes(
    `[${SOURCE_REPOSITORY}](https://github.com/${SOURCE_REPOSITORY})`,
  )
) {
  failures.push(
    "README.md: origin section must contain the canonical source repository link",
  );
}

if (failures.length > 0) {
  console.error(
    "Repository framing self-check failed:",
  );

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(
  [
    "Repository framing self-check passed.",
    `tracked_files=${trackedFiles.length}`,
    "course_framing=0",
    "role_labels=0",
    "source_reference=origin_only",
  ].join(" "),
);
