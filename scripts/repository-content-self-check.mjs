#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const sourceUrl = [
  "https://github.com",
  "lebed52",
  "pomidorqa-course-tests",
].join("/");

const forbiddenPatterns = [
  ["marker-01", new RegExp("\\b" + ["h", "w11"].join("") + "\\b", "i")],
  ["marker-02", new RegExp("\\b" + ["h", "w13"].join("") + "\\b", "i")],
  ["marker-03", new RegExp("\\b" + ["h", "w14"].join("") + "\\b", "i")],
  ["marker-04", new RegExp("\\b" + ["h", "w16"].join("") + "\\b", "i")],
  ["marker-05", new RegExp("\\b" + ["home", "work"].join("") + "\\b", "i")],
  ["marker-06", new RegExp("\\b" + ["les", "son"].join("") + "\\b", "i")],
  ["marker-07", new RegExp(["ку", "рс"].join(""), "iu")],
  ["marker-08", new RegExp(["ур", "ок"].join(""), "iu")],
  ["marker-09", new RegExp(["мара", "фон"].join(""), "iu")],
  ["marker-10", new RegExp(["уч", "еб"].join(""), "iu")],
  ["marker-11", new RegExp("\\b" + ["port", "folio"].join("") + "\\b", "i")],
  ["marker-12", new RegExp("\\b" + ["QA", "Senior"].join("") + "\\b", "i")],
  ["marker-13", new RegExp("\\b" + ["QA", "Lead"].join("") + "\\b", "i")],
  ["marker-14", new RegExp(["до", "маш"].join(""), "iu")],
  [
    "marker-15",
    new RegExp(
      "(^|[^\\p{L}\\p{N}_])" +
        ["Д", "З"].join("") +
        "($|[^\\p{L}\\p{N}_])",
      "iu",
    ),
  ],
];

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const textFiles = trackedFiles.filter(
  (file) =>
    /\\.(?:md|ts|tsx|js|mjs|cjs|json|ya?ml)$/i.test(file) &&
    file !== "package-lock.json",
);

const failures = [];
let sourceUrlCount = 0;
const sourceUrlFiles = [];

for (const file of textFiles) {
  const content = readFileSync(file, "utf8");

  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(content)) {
      failures.push(file + ": " + label);
    }
  }

  const matches = content.split(sourceUrl).length - 1;

  if (matches > 0) {
    sourceUrlCount += matches;
    sourceUrlFiles.push(file + " (" + matches + ")");
  }
}

const readme = readFileSync("README.md", "utf8");
const readmeSourceCount = readme.split(sourceUrl).length - 1;
const h2Headings = [...readme.matchAll(/^##\\s+(.+)$/gm)].map((match) =>
  match[1].trim(),
);
const lastH2 = h2Headings.at(-1);

if (sourceUrlCount !== 1 || readmeSourceCount !== 1) {
  failures.push(
    "provenance URL count must be exactly 1 in README; total=" +
      sourceUrlCount +
      ", README=" +
      readmeSourceCount +
      ", locations=" +
      sourceUrlFiles.join(", "),
  );
}

if (lastH2 !== "Происхождение кода и вклад") {
  failures.push(
    "README final H2 must be 'Происхождение кода и вклад'; actual=" +
      String(lastH2),
  );
}

if (failures.length > 0) {
  console.error("Repository content validation failed:");
  for (const failure of failures) {
    console.error("- " + failure);
  }
  process.exit(1);
}

console.log(
  "Repository content self-check passed: files=" +
    textFiles.length +
    "; provenance_url=1; final_section=ok",
);
