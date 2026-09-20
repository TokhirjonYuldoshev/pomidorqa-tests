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

    let wrongPasswordError = "";

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
      "Проверка: Получаем нейтральную ошибку авторизации",
      async () => {
        await expect(authPage.loginError).toBeVisible();
      },
    );

    await test.step(
      "Получаем нейтральную ошибку авторизации",
      async () => {
        wrongPasswordError =
          (await authPage.loginError.textContent())?.trim() ?? "";
      },
    );

    let unknownEmailError = "";

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
      "Проверка 1: Получаем такую же нейтральную ошибку",
      async () => {
        await expect(authPage.loginError).toBeVisible();
      },
    );

    await test.step(
      "Получаем такую же нейтральную ошибку",
      async () => {
        unknownEmailError =
          (await authPage.loginError.textContent())?.trim() ?? "";
      },
    );

    await test.step(
      "Проверка 2: Получаем такую же нейтральную ошибку",
      async () => {
        expect(unknownEmailError).toBe(wrongPasswordError);
        
        expect(unknownEmailError).toContain("Неверный");
      },
    );
  },
);
