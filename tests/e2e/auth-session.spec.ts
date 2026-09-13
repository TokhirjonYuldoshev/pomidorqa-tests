import { expect, test } from "../fixtures/app-fixtures";
import type { AppContext } from "../helpers/booking";
import { ROUTES } from "../helpers/routes";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
  type TestUser,
} from "../helpers/user";
import { AuthPage } from "../pages/auth-page";
import { HeaderPage } from "../pages/header-page";

const CATALOG_URL = /\/pomidorqa\/?$/;
const LOGIN_URL = /\/pomidorqa\/auth\/login\/?$/;

async function loginUser(
  app: AppContext,
  user: TestUser,
  password = user.password,
): Promise<void> {
  const authPage = new AuthPage(app.page);

  await authPage.gotoLogin();
  await authPage.login(user.email, password);
}

test.describe("Авторизация и сессия", () => {
  test(
    "зарегистрированный пользователь входит с корректными данными",
    async ({ appFactory }) => {
      const runId = makeRunId("login-success");
      const user = makeUser("login-user", runId);
      const setupApp = await appFactory();
      const loginApp = await appFactory();
      const header = new HeaderPage(loginApp.page);

      await test.step(
        "Arrange: создаём тестовый аккаунт через API",
        async () => {
          await registerUserViaApi(
            setupApp.context.request,
            user,
          );
        },
      );

      await test.step(
        "Пользователь входит с корректными данными",
        async () => {
          await loginUser(loginApp, user);
        },
      );

      await test.step(
        "После входа открыта главная и доступна кнопка выхода",
        async () => {
          await expect(loginApp.page).toHaveURL(CATALOG_URL);
          await expect(header.logoutButton).toBeVisible();
        },
      );
    },
  );

  test(
    "авторизованная сессия сохраняется после перезагрузки",
    async ({ appFactory }) => {
      const runId = makeRunId("session-reload");
      const user = makeUser("session-user", runId);
      const setupApp = await appFactory();
      const loginApp = await appFactory();
      const header = new HeaderPage(loginApp.page);

      await registerUserViaApi(
        setupApp.context.request,
        user,
      );

      await test.step("Пользователь входит в аккаунт", async () => {
        await loginUser(loginApp, user);
        await expect(loginApp.page).toHaveURL(CATALOG_URL);
      });

      await test.step("Перезагружаем страницу", async () => {
        await loginApp.page.reload();
      });

      await test.step(
        "После reload сессия остаётся авторизованной",
        async () => {
          await expect(header.logoutButton).toBeVisible();

          await loginApp.profilePage.goto();
          await expect(
            loginApp.profilePage.nameInput,
          ).toHaveValue(user.name);
        },
      );
    },
  );

  test(
    "выход завершает сессию и защищённый профиль требует новый вход",
    async ({ appFactory }) => {
      const runId = makeRunId("logout-session");
      const user = makeUser("logout-user", runId);
      const setupApp = await appFactory();
      const loginApp = await appFactory();
      const header = new HeaderPage(loginApp.page);

      await registerUserViaApi(
        setupApp.context.request,
        user,
      );

      await test.step("Пользователь входит в аккаунт", async () => {
        await loginUser(loginApp, user);
        await expect(header.logoutButton).toBeVisible();
      });

      await test.step("Пользователь выходит из аккаунта", async () => {
        await header.logout();
      });

      await test.step(
        "После выхода в header доступна ссылка входа",
        async () => {
          await expect(header.loginLink).toBeVisible();
        },
      );

      await test.step(
        "Прямой переход в профиль после logout отправляет на login",
        async () => {
          await loginApp.page.goto(ROUTES.profile);
          await expect(loginApp.page).toHaveURL(LOGIN_URL);
        },
      );
    },
  );

  test(
    "после неверного пароля корректный пароль позволяет войти в том же context",
    async ({ appFactory }) => {
      const runId = makeRunId("login-recovery");
      const user = makeUser("recovery-user", runId);
      const setupApp = await appFactory();
      const loginApp = await appFactory();
      const authPage = new AuthPage(loginApp.page);
      const header = new HeaderPage(loginApp.page);

      await registerUserViaApi(
        setupApp.context.request,
        user,
      );

      await test.step("Пробуем неверный пароль", async () => {
        await loginUser(
          loginApp,
          user,
          "wrong-password",
        );
      });

      await test.step(
        "Приложение показывает нейтральную ошибку и остаётся на login",
        async () => {
          await expect(authPage.loginError).toBeVisible();
          await expect(loginApp.page).toHaveURL(LOGIN_URL);
        },
      );

      await test.step(
        "В том же context вводим корректный пароль",
        async () => {
          await authPage.login(user.email, user.password);
        },
      );

      await test.step(
        "Recovery успешен: пользователь авторизован",
        async () => {
          await expect(loginApp.page).toHaveURL(CATALOG_URL);
          await expect(header.logoutButton).toBeVisible();
        },
      );
    },
  );

  test(
    "анонимный пользователь не может открыть профиль напрямую",
    async ({ appFactory }) => {
      const anonymousApp = await appFactory();

      await test.step(
        "Анонимный пользователь открывает защищённый профиль",
        async () => {
          await anonymousApp.page.goto(ROUTES.profile);
        },
      );

      await test.step(
        "Приложение перенаправляет пользователя на login",
        async () => {
          await expect(anonymousApp.page).toHaveURL(LOGIN_URL);
        },
      );
    },
  );

  test(
    "анонимный пользователь не может открыть список встреч напрямую",
    async ({ appFactory }) => {
      const anonymousApp = await appFactory();

      await test.step(
        "Анонимный пользователь открывает защищённые встречи",
        async () => {
          await anonymousApp.page.goto(ROUTES.bookings);
        },
      );

      await test.step(
        "Приложение перенаправляет пользователя на login",
        async () => {
          await expect(anonymousApp.page).toHaveURL(LOGIN_URL);
        },
      );
    },
  );
});
