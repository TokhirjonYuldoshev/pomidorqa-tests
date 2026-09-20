import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";
import { AuthPage } from "../pages/auth-page";

test(
  "вход с неверным паролем и неизвестным email показывает одинаковую ошибку",
  async ({ appFactory }) => {
    const runId = makeRunId("login-error");
    const user = makeUser("known", runId);
    const unknownUser = makeUser("unknown", runId);
    const setupApp = await appFactory();
    const authApp = await appFactory();
    const authPage = new AuthPage(authApp.page);

    await test.step(
      "Arrange: создаём известный аккаунт через API",
      async () => {
        await registerUserViaApi(
          setupApp.context.request,
          user,
        );
      },
    );

    await test.step(
      "Входим с верным email и неверным паролем",
      async () => {
        await authPage.gotoLogin();
        await authPage.login(
          user.email,
          "wrong-password",
        );
      },
    );

    await test.step(
      "Нейтральная ошибка авторизации видна",
      async () => {
        await expect(authPage.loginError).toBeVisible();
      },
    );

    const wrongPasswordError = await test.step(
      "Считываем текст ошибки неверного пароля",
      async () => (await authPage.loginError.textContent())?.trim() ?? "",
    );

    await test.step(
      "Входим с неизвестным email",
      async () => {
        await authPage.gotoLogin();
        await authPage.login(
          unknownUser.email,
          "any-password-123",
        );
      },
    );

    await test.step(
      "Нейтральная ошибка неизвестного email видна",
      async () => {
        await expect(authPage.loginError).toBeVisible();
      },
    );

    const unknownEmailError = await test.step(
      "Считываем текст ошибки неизвестного email",
      async () => (await authPage.loginError.textContent())?.trim() ?? "",
    );

    await test.step(
      "Ошибки одинаковые и не раскрывают неверное поле",
      async () => {
        expect(unknownEmailError).toBe(wrongPasswordError);
        expect(unknownEmailError).toContain("Неверный");
      },
    );
  },
);
