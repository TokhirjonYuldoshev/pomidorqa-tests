import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const walk = (dir, suffix) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory()
      ? walk(file, suffix)
      : entry.isFile() && entry.name.endsWith(suffix)
        ? [file]
        : [];
  });

const e2e = walk(path.join(root, "tests/e2e"), ".spec.ts").sort();
const errors = [];
const expectRe = /\bexpect(?:\.[\w$]+)*\s*\(/;
const add = (file, rule, message) =>
  errors.push(`${path.relative(root, file)} [${rule}] ${message}`);

function blockOf(call) {
  const fn = call.arguments.find(
    (arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg),
  );
  return fn && ts.isBlock(fn.body) ? fn.body : null;
}

for (const file of e2e) {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const relative = path.normalize(path.relative(root, file));

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(sourceFile);
      const block = blockOf(node);

      if (
        call === "test" &&
        block &&
        !block.getText(sourceFile).includes("test.step(")
      ) {
        add(file, "CODEX-4", "test has no test.step");
      }

      if (call === "test.step" && block) {
        const kinds = block.statements.map((statement) =>
          expectRe.test(statement.getText(sourceFile)),
        );
        if (kinds.some(Boolean) && kinds.some((value) => !value)) {
          add(file, "CODEX-4", "mixed action/assertion step");
        }
      }

      if (
        call === "registerUser" &&
        !relative.endsWith(path.normalize("tests/e2e/auth-registration.spec.ts"))
      ) {
        add(file, "CODEX-11", "use API Arrange");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const rules = [
    [/\.(getByRole|getByLabel|getByTestId|locator)\s*\(/g, "CODEX-1"],
    [/\.waitForTimeout\s*\(/g, "CODEX-9"],
    [/\.pause\s*\(/g, "CODEX-9"],
    [/\btest\.(only|skip)\s*\(/g, "CODEX-9"],
    [/\bforce\s*:\s*true\b/g, "CODEX-9"],
    [/\.newContext\s*\(/g, "CODEX-12"],
  ];
  for (const [pattern, rule] of rules) {
    if (pattern.test(source)) add(file, rule, pattern.source);
  }
}

for (const file of walk(path.join(root, "tests/pages"), ".ts")) {
  if (expectRe.test(readFileSync(file, "utf8"))) {
    add(file, "CODEX-2", "expect in Page Object");
  }
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
