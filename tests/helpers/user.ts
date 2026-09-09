import { expect, test, type Page } from "@playwright/test";
import { ROUTES } from "./routes";
import { makeUniqueToken } from "./test-data";

export type TestUser = {
  name: string;
  email: string;
  password: string;
};

export function makeUser(
  role: string,
  runId = makeUniqueToken(),
): TestUser {
  return {
    name: `${role} Автотест ${runId}`,
    email: `${role}-${runId}@example.com`,
    password: "testpass123",
  };
}

export async function registerUser(
  page: Page,
  user: TestUser,
): Promise<void> {
  await test.step(`Хелпер: Регистрация пользователя ${user.name}`, async () => {
    let registrationPageResponse;

    try {
      registrationPageResponse = await page.goto(ROUTES.register);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Не удалось открыть страницу регистрации для ${user.email}. ` +
          `URL: ${page.url()}. Причина: ${reason}`,
      );
    }

    if (
      registrationPageResponse &&
      registrationPageResponse.status() >= 400
    ) {
      throw new Error(
        `Страница регистрации для ${user.email} вернула ` +
          `HTTP ${registrationPageResponse.status()} ` +
          `${registrationPageResponse.statusText()}`,
      );
    }

    await page.getByLabel("Имя").fill(user.name);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Пароль").fill(user.password);

    const registrationPath = new URL(ROUTES.register, page.url()).pathname;
    const registrationResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === registrationPath,
      { timeout: 15_000 },
    );

    await page
      .getByRole("button", { name: "Зарегистрироваться" })
      .click();

    const registrationResponse = await registrationResponsePromise;

    if (registrationResponse.status() >= 400) {
      throw new Error(
        `Регистрация ${user.email} вернула ` +
          `HTTP ${registrationResponse.status()} ` +
          `${registrationResponse.statusText()}. ` +
          `URL: ${registrationResponse.url()}`,
      );
    }

    await expect(
      page,
      `После регистрации ${user.email} ожидается переход на главную PomidorQA`,
    ).toHaveURL(/\/pomidorqa\/?$/, {
      timeout: 15_000,
    });
  });
}
