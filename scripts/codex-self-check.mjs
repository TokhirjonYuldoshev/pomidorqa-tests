import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const e2eDir = path.join(root, "tests", "e2e");
const pagesDir = path.join(root, "tests", "pages");
const allowedUiRegistrationSpecs = new Set([
  path.normalize(path.join("tests", "e2e", "auth-registration.spec.ts")),
]);

function listFiles(dir, suffix) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return listFiles(absolute, suffix);
      }

      return entry.isFile() && entry.name.endsWith(suffix)
        ? [absolute]
        : [];
    })
    .sort();
}

function relative(file) {
  return path.normalize(path.relative(root, file));
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function isTestStepCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "step" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "test"
  );
}

function isTestCaseCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "test"
  );
}

function callbackBlock(call) {
  const callback = call.arguments.find(
    (argument) =>
      ts.isArrowFunction(argument) ||
      ts.isFunctionExpression(argument),
  );

  return callback && ts.isBlock(callback.body) ? callback.body : null;
}

function containsTestStep(node) {
  let found = false;

  function visit(current) {
    if (found) {
      return;
    }

    if (isTestStepCall(current)) {
      found = true;
      return;
    }

    ts.forEachChild(current, visit);
  }

  visit(node);
  return found;
}

function statementHasExpect(statement, sourceFile) {
  return /\bexpect(?:\.[A-Za-z_$][\w$]*)*\s*\(/.test(
    statement.getText(sourceFile),
  );
}

const violations = [];

function report(file, sourceFile, node, rule, message) {
  violations.push({
    file: relative(file),
    line: lineOf(sourceFile, node),
    rule,
    message,
  });
}

for (const file of listFiles(e2eDir, ".spec.ts")) {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const relativeFile = relative(file);

  function visit(node) {
    if (isTestCaseCall(node)) {
      const block = callbackBlock(node);

      if (block && !containsTestStep(block)) {
        report(
          file,
          sourceFile,
          node,
          "CODEX-4",
          "test case has no test.step",
        );
      }
    }

    if (isTestStepCall(node)) {
      const block = callbackBlock(node);

      if (block) {
        const statements = [...block.statements];
        const hasExpect = statements.some((statement) =>
          statementHasExpect(statement, sourceFile),
        );
        const hasNonExpect = statements.some(
          (statement) => !statementHasExpect(statement, sourceFile),
        );

        if (hasExpect && hasNonExpect) {
          report(
            file,
            sourceFile,
            node,
            "CODEX-4",
            "test.step mixes action/data statements with expect assertions",
          );
        }
      }
    }

    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "registerUser" &&
        !allowedUiRegistrationSpecs.has(relativeFile)
      ) {
        report(
          file,
          sourceFile,
          node,
          "CODEX-11",
          "UI registration is only allowed when registration itself is under test; use registerUserViaApi for Arrange",
        );
      }

      if (ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;

        if (
          new Set([
            "getByRole",
            "getByLabel",
            "getByTestId",
            "locator",
          ]).has(method)
        ) {
          report(
            file,
            sourceFile,
            node,
            "CODEX-1",
            `direct ${method} locator call in E2E spec; keep locators in Page Objects`,
          );
        }

        if (method === "waitForTimeout") {
          report(
            file,
            sourceFile,
            node,
            "CODEX-9",
            "waitForTimeout is forbidden",
          );
        }

        if (method === "pause") {
          report(
            file,
            sourceFile,
            node,
            "CODEX-9",
            "page.pause is forbidden",
          );
        }

        if (method === "newContext") {
          report(
            file,
            sourceFile,
            node,
            "CODEX-12",
            "BrowserContext must be owned by project fixtures/helpers, not created directly in E2E specs",
          );
        }

        if (
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "test" &&
          (method === "only" || method === "skip")
        ) {
          report(
            file,
            sourceFile,
            node,
            "CODEX-9",
            `test.${method} is forbidden`,
          );
        }
      }
    }

    if (
      ts.isPropertyAssignment(node) &&
      ((ts.isIdentifier(node.name) && node.name.text === "force") ||
        (ts.isStringLiteral(node.name) && node.name.text === "force")) &&
      node.initializer.kind === ts.SyntaxKind.TrueKeyword
    ) {
      report(
        file,
        sourceFile,
        node,
        "CODEX-9",
        "force: true is forbidden",
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

for (const file of listFiles(pagesDir, ".ts")) {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "expect"
    ) {
      report(
        file,
        sourceFile,
        node,
        "CODEX-2",
        "expect must stay in specs/helpers; Page Objects expose state and actions",
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

violations.sort(
  (left, right) =>
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.rule.localeCompare(right.rule),
);

if (violations.length > 0) {
  console.error(
    `CODEX self-check failed with ${violations.length} violation(s):`,
  );

  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`,
    );
  }

  process.exit(1);
}

console.log(
  `CODEX self-check passed: ${listFiles(e2eDir, ".spec.ts").length} E2E specs; mixed steps=0; forbidden constructs=0; UI registration scoped to registration coverage`,
);
