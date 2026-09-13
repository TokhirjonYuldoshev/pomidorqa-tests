import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import { makeUser, registerUserViaApi } from "../helpers/user";

test.describe("Авторизация", () => {
  test("пользователь входит с валидными данными", async ({ appFactory }) => {
    const runId = makeRunId("login-success");
    const user = makeUser("login", runId);

    const setupApp = await appFactory();
    const loginApp = await appFactory();

    await test.step("Создаём тестовый аккаунт через API", async () => {
      await registerUserViaApi(setupApp.context.request, user);
    });

    await test.step("Открываем логин и вводим валидные данные", async () => {
      await loginApp.authPage.gotoLogin();
      await loginApp.authPage.login(user.email, user.password);
    });

    await test.step("После входа открывается главная PomidorQA", async () => {
      await expect(loginApp.page).toHaveURL(/\/pomidorqa\/?$/, {
        timeout: 15_000,
      });
    });
  });

  test("после неверного пароля пользователь может войти с правильным", async ({
    appFactory,
  }) => {
    const runId = makeRunId("login-recovery");
    const user = makeUser("login", runId);

    const setupApp = await appFactory();
    const loginApp = await appFactory();

    await registerUserViaApi(setupApp.context.request, user);

    await test.step("Пробуем войти с неверным паролем", async () => {
      await loginApp.authPage.gotoLogin();
      await loginApp.authPage.login(user.email, "wrong-password");
    });

    await test.step("Ошибка авторизации показана", async () => {
      await expect(loginApp.authPage.loginError).toBeVisible();
    });

    await test.step("Повторяем вход с правильным паролем", async () => {
      await loginApp.authPage.login(user.email, user.password);
    });

    await test.step("Повторная попытка успешно авторизует пользователя", async () => {
      await expect(loginApp.page).toHaveURL(/\/pomidorqa\/?$/, {
        timeout: 15_000,
      });
    });
  });

  test("авторизация сохраняется после перезагрузки", async ({ appFactory }) => {
    const runId = makeRunId("login-session");
    const user = makeUser("login", runId);

    const setupApp = await appFactory();
    const loginApp = await appFactory();

    await registerUserViaApi(setupApp.context.request, user);

    await test.step("Авторизуемся", async () => {
      await loginApp.authPage.gotoLogin();
      await loginApp.authPage.login(user.email, user.password);
      await expect(loginApp.page).toHaveURL(/\/pomidorqa\/?$/, {
        timeout: 15_000,
      });
    });

    await test.step("Перезагружаем страницу", async () => {
      await loginApp.page.reload();
    });

    await test.step("Сессия остаётся активной и профиль доступен", async () => {
      await loginApp.profilePage.goto();
      await expect(loginApp.page).toHaveURL(/\/pomidorqa\/profile\/?$/);
      await expect(loginApp.profilePage.nameInput).toHaveValue(user.name);
    });
  });
});
