import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  snapshotPathTemplate: ".visual-snapshots/{testFilePath}/{arg}{ext}",
  use: {
    ...devices["Desktop Chrome"],
    browserName: "chromium",
    baseURL: process.env.POMIDORQA_BASE_URL ?? "https://aiqa.su",
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "Europe/Minsk",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
