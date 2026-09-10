import tseslint from "typescript-eslint";
import playwright from "eslint-plugin-playwright";

const playwrightRecommended = playwright.configs["flat/recommended"];

const baseRules = {
  "no-debugger": "error",
  "no-duplicate-imports": "error",
  "no-unreachable": "error",
};

export default [
  {
    ignores: [
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      ".qa-artifacts/**",
      ".visual-snapshots/**",
    ],
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "playwright.config.ts",
      "playwright.visual.config.ts",
    ],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: baseRules,
  },
  {
    files: ["scripts/**/*.mjs"],
    rules: baseRules,
  },
  {
    ...playwrightRecommended,
    files: ["tests/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      ...playwrightRecommended.rules,
      "playwright/no-wait-for-timeout": "error",
      "playwright/no-force-option": "error",
      "playwright/missing-playwright-await": "error",
      "playwright/no-commented-out-tests": "error",
      "playwright/no-page-pause": "error",
      "playwright/no-focused-test": "error",
      "playwright/no-skipped-test": "error",
      "playwright/expect-expect": "error",
      "playwright/no-conditional-in-test": "off",
      "playwright/consistent-spacing-between-blocks": "off",
      "playwright/no-useless-not": "off",
      "playwright/valid-title": "off",
    },
  },
];
