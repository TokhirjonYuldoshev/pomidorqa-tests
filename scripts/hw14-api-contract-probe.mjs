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

page.on("request", (request) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
    const body = request.postData() ?? "";
    const fieldNames = [...new URLSearchParams(body).keys()];
    mutations.push({
      method: request.method(),
      path: new URL(request.url()).pathname,
      contentType: request.headers()["content-type"] ?? null,
      fieldNames,
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
  }));

  console.log("DELETE_CANDIDATES", JSON.stringify(candidates));
  console.log("MUTATIONS", JSON.stringify(mutations));
} finally {
  await context.close();
  await browser.close();
}
