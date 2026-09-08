import { type Locator, type Page } from "@playwright/test";

const LOGIN_ROUTE = "/pomidorqa/auth/login";

export class AuthPage {
  readonly loginError: Locator;

  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;

  constructor(readonly page: Page) {
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Пароль");
    this.loginButton = page.getByRole("button", { name: "Войти" });
    this.loginError = page.getByText(/Неверный/);
  }

  async gotoLogin(): Promise<void> {
    await this.page.goto(LOGIN_ROUTE);
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
