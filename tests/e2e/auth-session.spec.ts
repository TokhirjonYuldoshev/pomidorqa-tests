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
const PROFILE_URL = /\/pomidorqa\/profile\/?$/;

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

  test(
    "анонимный пользователь не может открыть управление слотами напрямую",
    async ({ appFactory }) => {
      const anonymousApp = await appFactory();

      await test.step(
        "Анонимный пользователь открывает защищённое управление слотами",
        async () => {
          await anonymousApp.page.goto(ROUTES.slots);
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
    "вход в одном browser context не авторизует второй независимый context",
    async ({ appFactory }) => {
      test.setTimeout(60_000);

      const runId = makeRunId("context-isolation");
      const user = makeUser("context-user", runId);
      const setupApp = await appFactory();
      const authenticatedApp = await appFactory();
      const independentApp = await appFactory();
      const authenticatedHeader = new HeaderPage(
        authenticatedApp.page,
      );

      await test.step(
        "Arrange: создаём аккаунт и входим только в первый context",
        async () => {
          await registerUserViaApi(
            setupApp.context.request,
            user,
          );
          await loginUser(authenticatedApp, user);
          await expect(
            authenticatedHeader.logoutButton,
          ).toBeVisible();
        },
      );

      await test.step(
        "Второй независимый context открывает защищённый профиль",
        async () => {
          await independentApp.page.goto(ROUTES.profile);
        },
      );

      await test.step(
        "Второй context остаётся анонимным и перенаправляется на login",
        async () => {
          await expect(independentApp.page).toHaveURL(LOGIN_URL);
        },
      );

      await test.step(
        "Первый context по-прежнему авторизован своим пользователем",
        async () => {
          await authenticatedApp.profilePage.goto();
          await expect(authenticatedApp.page).toHaveURL(PROFILE_URL);
          await expect(
            authenticatedApp.profilePage.nameInput,
          ).toHaveValue(user.name);
        },
      );
    },
  );

  test(
    "logout одного пользователя не завершает независимую сессию второго пользователя",
    async ({ appFactory }) => {
      test.setTimeout(60_000);

      const runId = makeRunId("logout-isolation");
      const userOne = makeUser("user-one", runId);
      const userTwo = makeUser("user-two", runId);
      const setupOneApp = await appFactory();
      const setupTwoApp = await appFactory();
      const sessionOneApp = await appFactory();
      const sessionTwoApp = await appFactory();
      const sessionOneHeader = new HeaderPage(sessionOneApp.page);
      const sessionTwoHeader = new HeaderPage(sessionTwoApp.page);

      await test.step(
        "Arrange: создаём два аккаунта и открываем две независимые сессии",
        async () => {
          await registerUserViaApi(
            setupOneApp.context.request,
            userOne,
          );
          await registerUserViaApi(
            setupTwoApp.context.request,
            userTwo,
          );

          await loginUser(sessionOneApp, userOne);
          await loginUser(sessionTwoApp, userTwo);

          await expect(
            sessionOneHeader.logoutButton,
          ).toBeVisible();
          await expect(
            sessionTwoHeader.logoutButton,
          ).toBeVisible();
        },
      );

      await test.step(
        "Первый пользователь завершает свою сессию",
        async () => {
          await sessionOneHeader.logout();
          await expect(sessionOneHeader.loginLink).toBeVisible();
        },
      );

      await test.step(
        "Первая сессия больше не имеет доступа к защищённому профилю",
        async () => {
          await sessionOneApp.page.goto(ROUTES.profile);
          await expect(sessionOneApp.page).toHaveURL(LOGIN_URL);
        },
      );

      await test.step(
        "Вторая независимая сессия остаётся авторизованной",
        async () => {
          await sessionTwoApp.profilePage.goto();
          await expect(sessionTwoApp.page).toHaveURL(PROFILE_URL);
          await expect(
            sessionTwoApp.profilePage.nameInput,
          ).toHaveValue(userTwo.name);
          await expect(
            sessionTwoHeader.logoutButton,
          ).toBeVisible();
        },
      );
    },
  );
});
