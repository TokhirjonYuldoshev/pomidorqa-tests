import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const files = (dir, suffix) =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory()
        ? files(full, suffix)
        : entry.isFile() && entry.name.endsWith(suffix)
          ? [full]
          : [];
    })
    .sort();

const e2e = files(path.join(root, "tests/e2e"), ".spec.ts");
const pages = files(path.join(root, "tests/pages"), ".ts");
const violations = [];
const expectPattern = /\bexpect(?:\.[A-Za-z_$][\w$]*)*\s*\(/;

function parse(file) {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function callbackBlock(call) {
  const callback = call.arguments.find(
    (arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg),
  );
  return callback && ts.isBlock(callback.body) ? callback.body : null;
}

function hasStep(node, sourceFile) {
  let found = false;
  const visit = (current) => {
    if (found) return;
    if (
      ts.isCallExpression(current) &&
      current.expression.getText(sourceFile) === "test.step"
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function add(file, sourceFile, node, rule, message) {
  const line =
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  violations.push(
    `${path.relative(root, file)}:${line} [${rule}] ${message}`,
  );
}

for (const file of e2e) {
  const sourceFile = parse(file);
  const relative = path.normalize(path.relative(root, file));

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sourceFile);

      if (callee === "test") {
        const block = callbackBlock(node);
        if (block && !hasStep(block, sourceFile)) {
          add(file, sourceFile, node, "CODEX-4", "test case has no test.step");
        }
      }

      if (callee === "test.step") {
        const block = callbackBlock(node);
        if (block) {
          const kinds = block.statements.map((statement) =>
            expectPattern.test(statement.getText(sourceFile)),
          );
          if (kinds.some(Boolean) && kinds.some((value) => !value)) {
            add(
              file,
              sourceFile,
              node,
              "CODEX-4",
              "test.step mixes action/data statements with expect assertions",
            );
          }
        }
      }

      if (
        callee === "registerUser" &&
        !relative.endsWith(path.normalize("tests/e2e/auth-registration.spec.ts"))
      ) {
        add(
          file,
          sourceFile,
          node,
          "CODEX-11",
          "use registerUserViaApi for Arrange outside registration coverage",
        );
      }

      if (/\.(getByRole|getByLabel|getByTestId|locator)$/.test(callee)) {
        add(file, sourceFile, node, "CODEX-1", "direct locator in E2E spec");
      }
      if (/\.waitForTimeout$/.test(callee)) {
        add(file, sourceFile, node, "CODEX-9", "waitForTimeout is forbidden");
      }
      if (/\.pause$/.test(callee)) {
        add(file, sourceFile, node, "CODEX-9", "page.pause is forbidden");
      }
      if (/\.newContext$/.test(callee)) {
        add(file, sourceFile, node, "CODEX-12", "newContext belongs in fixtures/helpers");
      }
      if (callee === "test.only" || callee === "test.skip") {
        add(file, sourceFile, node, "CODEX-9", `${callee} is forbidden`);
      }
    }

    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(sourceFile).replaceAll(/['"]/g, "") === "force" &&
      node.initializer.kind === ts.SyntaxKind.TrueKeyword
    ) {
      add(file, sourceFile, node, "CODEX-9", "force: true is forbidden");
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

for (const file of pages) {
  const sourceFile = parse(file);
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      /^expect(?:\.[A-Za-z_$][\w$]*)*$/.test(
        node.expression.getText(sourceFile),
      )
    ) {
      add(file, sourceFile, node, "CODEX-2", "expect must not live in Page Objects");
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

violations.sort();

if (violations.length) {
  console.error(
    `CODEX self-check failed with ${violations.length} violation(s):\n${violations
      .map((item) => `- ${item}`)
      .join("\n")}`,
  );
  process.exit(1);
}

console.log(
  `CODEX self-check passed: ${e2e.length} E2E specs; mixed steps=0; forbidden constructs=0; UI registration scoped to registration coverage`,
);
