import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import { makeUser, registerUserViaApi } from "../helpers/user";

test("вход с неверным паролем и неизвестным email показывает одинаковую ошибку", async ({
  appFactory,
}) => {
  const runId = makeRunId("login-error");
  const user = makeUser("known", runId);
  const unknownUser = makeUser("unknown", runId);

  const setupApp = await appFactory();
  const loginApp = await appFactory();

  await test.step("Создаём реальный аккаунт через API", async () => {
    await registerUserViaApi(setupApp.context.request, user);
  });

  let wrongPasswordError = "";

  await test.step("Входим с верным email и неверным паролем", async () => {
    await loginApp.authPage.gotoLogin();
    await loginApp.authPage.login(user.email, "wrong-password");
  });

  await test.step("Получаем нейтральную ошибку авторизации", async () => {
    await expect(loginApp.authPage.loginError).toBeVisible();
    wrongPasswordError =
      (await loginApp.authPage.loginError.textContent())?.trim() ?? "";
  });

  let unknownEmailError = "";

  await test.step("Входим с неизвестным email", async () => {
    await loginApp.authPage.gotoLogin();
    await loginApp.authPage.login(
      unknownUser.email,
      "any-password-123",
    );
  });

  await test.step("Получаем такую же нейтральную ошибку", async () => {
    await expect(loginApp.authPage.loginError).toBeVisible();
    unknownEmailError =
      (await loginApp.authPage.loginError.textContent())?.trim() ?? "";

    expect(unknownEmailError).toBe(wrongPasswordError);
    expect(unknownEmailError).toContain("Неверный");
  });
});
