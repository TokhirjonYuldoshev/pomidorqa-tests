import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.POMIDORQA_BASE_URL ?? "https://aiqa.su").replace(
  /\/+$/,
  "",
);
const registrationPath = "/pomidorqa/auth/register";
const registrationUrl = new URL(registrationPath, `${baseUrl}/`).toString();
const artifactDir = ".qa-artifacts/registration-contract";
const summaryPath = `${artifactDir}/summary.json`;

const result = {
  checkedAt: new Date().toISOString(),
  baseUrl,
  expected: {
    requestMethod: "POST",
    requestPath: registrationPath,
    responseStatus: 303,
    finalPath: "/pomidorqa",
  },
  actual: {},
  status: "failed",
};

await mkdir(artifactDir, { recursive: true });

let browser;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const pageResponse = await page.goto(registrationUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  if (!pageResponse) {
    throw new Error(`Registration page returned no HTTP response: ${registrationUrl}`);
  }

  result.actual.pageStatus = pageResponse.status();

  if (pageResponse.status() >= 400) {
    throw new Error(
      `Registration page returned HTTP ${pageResponse.status()} ${pageResponse.statusText()}`,
    );
  }

  const unique = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const user = {
    name: `Contract Smoke ${unique}`,
    email: `contract-smoke-${unique}@example.com`,
    password: "testpass123",
  };

  result.actual.testUserEmail = user.email;

  await page.getByLabel("Имя").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Пароль").fill(user.password);

  const registrationResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === registrationPath,
    { timeout: 15_000 },
  );

  await page
    .getByRole("button", { name: "Зарегистрироваться" })
    .click();

  const registrationResponse = await registrationResponsePromise;

  result.actual.requestMethod = registrationResponse.request().method();
  result.actual.requestPath = new URL(registrationResponse.url()).pathname;
  result.actual.responseStatus = registrationResponse.status();

  if (registrationResponse.status() !== 303) {
    throw new Error(
      `Registration contract changed: expected HTTP 303, got ` +
        `${registrationResponse.status()} ${registrationResponse.statusText()}`,
    );
  }

  await page.waitForURL(
    (url) => url.pathname === "/pomidorqa" || url.pathname === "/pomidorqa/",
    { timeout: 15_000 },
  );

  result.actual.finalUrl = page.url();
  result.actual.finalPath = new URL(page.url()).pathname;
  result.status = "passed";

  console.log(
    `Registration contract OK: POST ${registrationPath} -> 303 -> ${result.actual.finalPath}`,
  );
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
  console.error(`Registration contract smoke failed: ${result.error}`);
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }

  await writeFile(summaryPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Contract summary written to ${summaryPath}`);
}
