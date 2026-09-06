import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [["line"], ["github"], ["html", { open: "never" }]]
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
      retries: isCI ? 2 : 0,
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
