import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

const e2eDevices = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
} as const;

const requestedBrowser = process.env.E2E_BROWSER ?? "chromium";

if (!(requestedBrowser in e2eDevices)) {
  throw new Error(`Unsupported E2E_BROWSER: ${requestedBrowser}`);
}

const e2eBrowser = requestedBrowser as keyof typeof e2eDevices;

export default defineConfig({
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI
    ? [
        ["line"],
        ["github"],
        ["html", { open: "never" }],
        ["allure-playwright", { resultsDir: "allure-results" }],
      ]
    : [
        ["list"],
        ["html", { open: "on-failure" }],
        ["allure-playwright", { resultsDir: "allure-results" }],
      ],
  projects: [
    {
      name: "unit",
      testDir: "./tests/unit",
    },
    {
      name: "api",
      testDir: "./tests/api",
    },
    {
      name: "e2e",
      testDir: "./tests/e2e",
      use: {
        ...e2eDevices[e2eBrowser],
        browserName: e2eBrowser,
        baseURL: process.env.POMIDORQA_BASE_URL ?? "https://aiqa.su",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
      },
    },
  ],
});
