import { type Locator, type Page } from "@playwright/test";
import { ROUTES } from "../helpers/routes";
import { type TestUser } from "../helpers/user";

export class RegisterPage {
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(readonly page: Page) {
    this.nameInput = page.getByLabel("Имя", { exact: true });
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Пароль");
    this.submitButton = page.getByRole("button", {
      name: "Зарегистрироваться",
    });
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.register);
  }

  async fillForm(user: TestUser): Promise<void> {
    await this.nameInput.fill(user.name);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
