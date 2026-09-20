import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const walk = (dir, suffix) =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory()
        ? walk(file, suffix)
        : entry.isFile() && entry.name.endsWith(suffix)
          ? [file]
          : [];
    })
    .sort();

const e2e = walk(path.join(root, "tests/e2e"), ".spec.ts");
const pages = walk(path.join(root, "tests/pages"), ".ts");
const errors = [];
const expectRe = /\bexpect(?:\.[\w$]+)*\s*\(/;

const parse = (file, source) =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function blockOf(call) {
  const fn = call.arguments.find(
    (arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg),
  );
  return fn && ts.isBlock(fn.body) ? fn.body : null;
}

function hasStep(node, sourceFile) {
  let found = false;
  const visit = (child) => {
    if (found) return;
    if (
      ts.isCallExpression(child) &&
      child.expression.getText(sourceFile) === "test.step"
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function add(file, source, index, rule, message) {
  const line = source.slice(0, index).split("\n").length;
  errors.push(`${path.relative(root, file)}:${line} [${rule}] ${message}`);
}

for (const file of e2e) {
  const source = readFileSync(file, "utf8");
  const sourceFile = parse(file, source);
  const rel = path.normalize(path.relative(root, file));

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(sourceFile);
      const block = blockOf(node);

      if (call === "test" && block && !hasStep(block, sourceFile)) {
        add(file, source, node.getStart(), "CODEX-4", "test has no test.step");
      }

      if (call === "test.step" && block) {
        const kinds = block.statements.map((statement) =>
          expectRe.test(statement.getText(sourceFile)),
        );
        if (kinds.some(Boolean) && kinds.some((value) => !value)) {
          add(file, source, node.getStart(), "CODEX-4", "mixed action/assertion step");
        }
      }

      if (
        call === "registerUser" &&
        !rel.endsWith(path.normalize("tests/e2e/auth-registration.spec.ts"))
      ) {
        add(file, source, node.getStart(), "CODEX-11", "use API Arrange");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const rules = [
    [/\.(getByRole|getByLabel|getByTestId|locator)\s*\(/g, "CODEX-1", "direct locator"],
    [/\.waitForTimeout\s*\(/g, "CODEX-9", "waitForTimeout"],
    [/\.pause\s*\(/g, "CODEX-9", "page.pause"],
    [/\btest\.(only|skip)\s*\(/g, "CODEX-9", "focused/skipped test"],
    [/\bforce\s*:\s*true\b/g, "CODEX-9", "force: true"],
    [/\.newContext\s*\(/g, "CODEX-12", "newContext in spec"],
  ];

  for (const [re, rule, message] of rules) {
    for (const match of source.matchAll(re)) {
      add(file, source, match.index, rule, message);
    }
  }
}

for (const file of pages) {
  const source = readFileSync(file, "utf8");
  const match = expectRe.exec(source);
  if (match) add(file, source, match.index, "CODEX-2", "expect in Page Object");
}

errors.sort();
if (errors.length) {
  console.error(
    `CODEX self-check failed (${errors.length}):\n${errors
      .map((error) => `- ${error}`)
      .join("\n")}`,
  );
  process.exit(1);
}

console.log(
  `CODEX self-check passed: ${e2e.length} E2E specs; mixed steps=0; forbidden constructs=0; UI registration scoped to registration coverage`,
);
