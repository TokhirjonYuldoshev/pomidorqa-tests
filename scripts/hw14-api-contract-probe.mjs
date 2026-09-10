import { chromium } from "@playwright/test";

const baseURL = process.env.POMIDORQA_BASE_URL ?? "https://aiqa.su";
const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const user = {
  name: `HW14 Probe ${unique}`,
  email: `hw14-probe-${unique}@example.com`,
  password: "testpass123",
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL });
const page = await context.newPage();
const mutations = [];
const appRequests = new Set();

page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.origin === new URL(baseURL).origin && !url.pathname.startsWith("/_next/")) {
    appRequests.add(`${request.method()} ${url.pathname}`);
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
    mutations.push({
      method: request.method(),
      path: url.pathname,
      contentType: request.headers()["content-type"] ?? null,
    });
  }
});

try {
  await page.goto("/pomidorqa/auth/register");

  const form = await page.locator("form").first().evaluate((node) => ({
    action: node.getAttribute("action"),
    method: node.getAttribute("method"),
    inputs: Array.from(node.querySelectorAll("input"))
      .map((input) => input.getAttribute("name"))
      .filter(Boolean),
  }));
  console.log("REGISTRATION_FORM", JSON.stringify(form));

  await page.getByLabel("Имя").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Пароль").fill(user.password);

  const registrationResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/pomidorqa/auth/register",
  );

  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  const registrationResponse = await registrationResponsePromise;
  await page.waitForURL(/\/pomidorqa\/?$/);

  console.log(
    "REGISTRATION_CONTRACT",
    JSON.stringify({
      method: registrationResponse.request().method(),
      path: new URL(registrationResponse.url()).pathname,
      status: registrationResponse.status(),
    }),
  );

  await page.goto("/pomidorqa/profile");

  const candidates = await page.evaluate(() => ({
    forms: Array.from(document.forms).map((form) => ({
      action: form.getAttribute("action"),
      method: form.getAttribute("method"),
      text: (form.textContent ?? "").replace(/\s+/g, " ").trim(),
    })).filter((item) => /удал|delete|remove|аккаунт|профил/i.test(`${item.action ?? ""} ${item.text}`)),
    links: Array.from(document.querySelectorAll("a")).map((link) => ({
      href: link.getAttribute("href"),
      text: (link.textContent ?? "").replace(/\s+/g, " ").trim(),
    })).filter((item) => /удал|delete|remove|аккаунт/i.test(`${item.href ?? ""} ${item.text}`)),
    buttons: Array.from(document.querySelectorAll("button")).map((button) => ({
      text: (button.textContent ?? "").replace(/\s+/g, " ").trim(),
    })).filter((item) => /удал|delete|remove|аккаунт/i.test(item.text)),
    scripts: Array.from(document.scripts).map((script) => script.src).filter(Boolean),
  }));

  console.log("DELETE_CANDIDATES", JSON.stringify({
    forms: candidates.forms,
    links: candidates.links,
    buttons: candidates.buttons,
  }));

  for (const src of candidates.scripts) {
    try {
      const response = await context.request.get(src);
      if (!response.ok()) continue;
      const source = await response.text();
      const hints = source.match(/.{0,120}(?:\/api\/[A-Za-z0-9_./?=&-]+|deleteUser|deleteAccount|removeUser|удалить).{0,120}/gi) ?? [];
      if (hints.length > 0) {
        console.log("SCRIPT_HINTS", JSON.stringify({
          path: new URL(src).pathname,
          hints: hints.slice(0, 20),
        }));
      }
    } catch {
      // Diagnostic only: an unreadable chunk must not fail the probe.
    }
  }

  console.log("APP_REQUESTS", JSON.stringify([...appRequests].sort()));
  console.log("MUTATIONS", JSON.stringify(mutations));
} finally {
  await context.close();
  await browser.close();
}
