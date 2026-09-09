import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const isAllureEnabled = process.env.ALLURE_ENABLED === "true";

export default defineConfig({
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI
    ? isAllureEnabled
      ? [
          ["line"],
          ["github"],
          ["html", { open: "never" }],
          ["allure-playwright", { resultsDir: "allure-results" }],
        ]
      : [["line"], ["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "on-failure" }]],
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
        ...devices["Desktop Chrome"],
        baseURL: process.env.POMIDORQA_BASE_URL ?? "https://aiqa.su",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
      },
    },
  ],
});
