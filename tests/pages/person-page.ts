import { type Locator, type Page } from "@playwright/test";

export class PersonPage {
  readonly content: Locator;
  readonly name: Locator;
  readonly canHelpSection: Locator;
  readonly wantToLearnSection: Locator;

  constructor(readonly page: Page) {
    this.content = page.locator("main");
    this.name = page.getByRole("heading", { level: 1 });
    this.canHelpSection = page.getByText(/может помочь с/i).locator("..");
    this.wantToLearnSection = page.getByText(/хочет разобрать/i).locator("..");
  }
}
