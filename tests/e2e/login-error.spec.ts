import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";
import { AuthPage } from "../pages/auth-page";

test.describe("Авторизация", () => {
  test("валидный пользователь входит и сохраняет сессию после reload", async ({
    appFactory,
  }) => {
    const runId = makeRunId("login-success");
    const user = makeUser("known", runId);

    const setupApp = await appFactory();
    const loginApp = await appFactory();
    const authPage = new AuthPage(loginApp.page);

    await test.step("Создаём тестовый аккаунт через API", async () => {
      await registerUserViaApi(
        setupApp.context.request,
        user,
      );
    });

    await test.step("Входим с валидными учётными данными", async () => {
      await authPage.gotoLogin();
      await authPage.login(user.email, user.password);
    });

    await test.step("После входа открывается PomidorQA", async () => {
      await expect(loginApp.page).toHaveURL(/\/pomidorqa\/?$/, {
        timeout: 15_000,
      });
    });

    await test.step("Открываем защищённую страницу профиля", async () => {
      await loginApp.profilePage.goto();
    });

    await test.step("Авторизованная сессия даёт доступ к профилю", async () => {
      await expect(loginApp.page).toHaveURL(/\/pomidorqa\/profile\/?$/);
      await expect(loginApp.profilePage.nameInput).toBeVisible();
    });

    await test.step("Перезагружаем профиль", async () => {
      await loginApp.page.reload();
    });

    await test.step("Сессия сохраняется после reload", async () => {
      await expect(loginApp.page).toHaveURL(/\/pomidorqa\/profile\/?$/);
      await expect(loginApp.profilePage.nameInput).toBeVisible();
    });
  });

  test("вход с неверным паролем и неизвестным email показывает одинаковую ошибку", async ({
    appFactory,
  }) => {
    const runId = makeRunId("login-error");
    const user = makeUser("known", runId);
    const unknownUser = makeUser("unknown", runId);

    const setupApp = await appFactory();
    const loginApp = await appFactory();
    const authPage = new AuthPage(loginApp.page);

    await test.step("Создаём реальный аккаунт через API", async () => {
      await registerUserViaApi(
        setupApp.context.request,
        user,
      );
    });

    let wrongPasswordError = "";

    await test.step("Входим с верным email и неверным паролем", async () => {
      await authPage.gotoLogin();
      await authPage.login(user.email, "wrong-password");
    });

    await test.step("Получаем нейтральную ошибку авторизации", async () => {
      await expect(authPage.loginError).toBeVisible();
      wrongPasswordError =
        (await authPage.loginError.textContent())?.trim() ?? "";
    });

    let unknownEmailError = "";

    await test.step("Входим с неизвестным email", async () => {
      await authPage.gotoLogin();
      await authPage.login(
        unknownUser.email,
        "any-password-123",
      );
    });

    await test.step("Получаем такую же нейтральную ошибку", async () => {
      await expect(authPage.loginError).toBeVisible();
      unknownEmailError =
        (await authPage.loginError.textContent())?.trim() ?? "";

      expect(unknownEmailError).toBe(wrongPasswordError);
      expect(unknownEmailError).toContain("Неверный");
    });
  });

  test("после неверного пароля пользователь может войти с корректным", async ({
    appFactory,
  }) => {
    const runId = makeRunId("login-recovery");
    const user = makeUser("recovery", runId);

    const setupApp = await appFactory();
    const loginApp = await appFactory();
    const authPage = new AuthPage(loginApp.page);

    await test.step("Создаём тестовый аккаунт через API", async () => {
      await registerUserViaApi(
        setupApp.context.request,
        user,
      );
    });

    await test.step("Первая попытка входа использует неверный пароль", async () => {
      await authPage.gotoLogin();
      await authPage.login(user.email, "wrong-password");
    });

    await test.step("Ошибка авторизации отображается", async () => {
      await expect(authPage.loginError).toBeVisible();
    });

    await test.step("Повторяем вход уже с корректным паролем", async () => {
      await authPage.login(user.email, user.password);
    });

    await test.step("Корректная повторная попытка успешно авторизует пользователя", async () => {
      await expect(loginApp.page).toHaveURL(/\/pomidorqa\/?$/, {
        timeout: 15_000,
      });
      await expect(authPage.loginError).not.toBeVisible();
    });
  });
});
