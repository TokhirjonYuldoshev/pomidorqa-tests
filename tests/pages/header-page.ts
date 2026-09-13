import { type Locator, type Page } from "@playwright/test";

export class HeaderPage {
  readonly logoutButton: Locator;
  readonly loginLink: Locator;

  constructor(readonly page: Page) {
    this.logoutButton = page.getByTestId(
      "PomidorqaHeader-logout-button",
    );
    this.loginLink = page.getByTestId(
      "PomidorqaHeader-login-link",
    );
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }

  async openLogin(): Promise<void> {
    await this.loginLink.click();
  }
}
