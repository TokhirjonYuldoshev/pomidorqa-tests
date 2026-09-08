import { expect, test } from "@playwright/test";
import { makeUser, registerUser } from "../helpers/user";
import { AuthPage } from "../pages/auth-page";

test("вход с неверным паролем и неизвестным email показывает одинаковую ошибку", async ({
  page,
}) => {
  const user = makeUser("login-error");
  const authPage = new AuthPage(page);

  await test.step("Регистрируем реальный аккаунт", async () => {
    await registerUser(page, user);
  });

  let wrongPasswordError = "";

  await test.step("Входим с верным email и неверным паролем", async () => {
    await authPage.gotoLogin();
    await authPage.login(user.email, "wrong-password");
  });

  await test.step("Получаем нейтральную ошибку авторизации", async () => {
    await expect(authPage.loginError).toBeVisible();
    wrongPasswordError = (await authPage.loginError.textContent())?.trim() ?? "";
  });

  let unknownEmailError = "";

  await test.step("Входим с неизвестным email", async () => {
    await authPage.gotoLogin();
    await authPage.login(`no-such-${Date.now()}@example.com`, "any-password-123");
  });

  await test.step("Получаем такую же нейтральную ошибку", async () => {
    await expect(authPage.loginError).toBeVisible();
    unknownEmailError = (await authPage.loginError.textContent())?.trim() ?? "";
    expect(unknownEmailError).toBe(wrongPasswordError);
    expect(unknownEmailError).toContain("Неверный");
  });
});
