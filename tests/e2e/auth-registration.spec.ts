import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import { makeUser, registerUser } from "../helpers/user";
import { RegisterPage } from "../pages/register-page";

test.describe("Регистрация: требования MVP", () => {
  test("после регистрации профиль получает имя и Europe/Moscow", async ({
    appFactory,
  }) => {
    const app = await appFactory();
    const user = makeUser("default-profile", makeRunId("default-profile"));

    await test.step("Регистрируем пользователя через UI", async () => {
      await registerUser(app.page, user);
    });

    await test.step("Проверяем автоматически созданный профиль", async () => {
      await app.profilePage.goto();
      await expect(app.profilePage.nameInput).toHaveValue(user.name);
      await expect(app.profilePage.timezoneSelect).toHaveValue(
        "Europe/Moscow",
      );
    });
  });

  test("форма блокирует пустые обязательные поля и короткий пароль", async ({
    appFactory,
  }) => {
    const app = await appFactory();
    const registerPage = new RegisterPage(app.page);

    await test.step("Отправляем пустую форму", async () => {
      await registerPage.goto();
      await registerPage.submit();
    });

    await test.step("Имя, email и пароль обязательны", async () => {
      expect(
        await registerPage.nameInput.evaluate((input) => input.validity.valid),
      ).toBe(false);
      expect(
        await registerPage.emailInput.evaluate((input) => input.validity.valid),
      ).toBe(false);
      expect(
        await registerPage.passwordInput.evaluate(
          (input) => input.validity.valid,
        ),
      ).toBe(false);
    });

    await test.step("Заполняем валидные имя/email и короткий пароль", async () => {
      await registerPage.nameInput.fill("Validation User");
      await registerPage.emailInput.fill(
        `validation-${makeRunId("short-password")}@example.com`,
      );
      await registerPage.passwordInput.fill("short");
      await registerPage.submit();
    });

    await test.step("Пароль короче восьми символов отклоняется", async () => {
      expect(
        await registerPage.passwordInput.evaluate(
          (input) => input.validity.valid,
        ),
      ).toBe(false);
      await expect(app.page).toHaveURL(/\/pomidorqa\/auth\/register$/);
    });
  });
});
