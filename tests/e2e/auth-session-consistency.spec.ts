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
import { ProfilePage } from "../pages/profile-page";

const CATALOG_URL = /\/pomidorqa\/?$/;
const LOGIN_URL = /\/pomidorqa\/auth\/login\/?$/;
const PROFILE_URL = /\/pomidorqa\/profile\/?$/;

async function loginUser(
  app: AppContext,
  user: TestUser,
): Promise<void> {
  const authPage = new AuthPage(app.page);

  await authPage.gotoLogin();
  await authPage.login(user.email, user.password);
  await expect(app.page).toHaveURL(CATALOG_URL);
}

test.describe("Согласованность авторизованной сессии", () => {
  test(
    "две вкладки одного browser context используют одну авторизованную сессию",
    async ({ appFactory }) => {
      const runId = makeRunId("same-context-tabs");
      const user = makeUser("tabs-user", runId);
      const setupApp = await appFactory();
      const sessionApp = await appFactory();

      await test.step(
        "Arrange: создаём аккаунт и авторизуем первую вкладку",
        async () => {
          await registerUserViaApi(
            setupApp.context.request,
            user,
          );
          await loginUser(sessionApp, user);
        },
      );

      const secondPage = await sessionApp.context.newPage();
      const secondProfile = new ProfilePage(secondPage);
      const secondHeader = new HeaderPage(secondPage);

      await test.step(
        "Вторая вкладка того же context открывает защищённый профиль",
        async () => {
          await secondPage.goto(ROUTES.profile);
        },
      );

      await test.step(
        "Вторая вкладка видит ту же авторизованную сессию",
        async () => {
          await expect(secondPage).toHaveURL(PROFILE_URL);
          await expect(secondProfile.nameInput).toHaveValue(
            user.name,
          );
          await expect(secondHeader.logoutButton).toBeVisible();
        },
      );
    },
  );

  test(
    "logout в одной вкладке завершает ту же сессию во второй вкладке после нового запроса",
    async ({ appFactory }) => {
      const runId = makeRunId("same-context-logout");
      const user = makeUser("logout-tabs-user", runId);
      const setupApp = await appFactory();
      const sessionApp = await appFactory();
      const firstHeader = new HeaderPage(sessionApp.page);

      await test.step(
        "Arrange: создаём аккаунт и авторизуем первую вкладку",
        async () => {
          await registerUserViaApi(
            setupApp.context.request,
            user,
          );
          await loginUser(sessionApp, user);
        },
      );

      const secondPage = await sessionApp.context.newPage();
      const secondProfile = new ProfilePage(secondPage);

      await test.step(
        "Вторая вкладка подтверждает общую авторизованную сессию",
        async () => {
          await secondPage.goto(ROUTES.profile);
          await expect(secondPage).toHaveURL(PROFILE_URL);
          await expect(secondProfile.nameInput).toHaveValue(
            user.name,
          );
        },
      );

      await test.step(
        "Первая вкладка выполняет logout",
        async () => {
          await firstHeader.logout();
          await expect(firstHeader.loginLink).toBeVisible();
        },
      );

      await test.step(
        "Вторая вкладка после нового запроса больше не имеет доступа к профилю",
        async () => {
          await secondPage.goto(ROUTES.profile);
          await expect(secondPage).toHaveURL(LOGIN_URL);
        },
      );
    },
  );

  test(
    "после logout вход другим пользователем в том же context не сохраняет прежнюю личность",
    async ({ appFactory }) => {
      const runId = makeRunId("session-switch");
      const userOne = makeUser("switch-one", runId);
      const userTwo = makeUser("switch-two", runId);
      const setupOneApp = await appFactory();
      const setupTwoApp = await appFactory();
      const sessionApp = await appFactory();
      const header = new HeaderPage(sessionApp.page);
      const authPage = new AuthPage(sessionApp.page);

      await test.step(
        "Arrange: создаём два независимых тестовых аккаунта",
        async () => {
          await registerUserViaApi(
            setupOneApp.context.request,
            userOne,
          );
          await registerUserViaApi(
            setupTwoApp.context.request,
            userTwo,
          );
        },
      );

      await test.step(
        "Первый пользователь входит и видит собственный профиль",
        async () => {
          await loginUser(sessionApp, userOne);
          await sessionApp.profilePage.goto();
          await expect(
            sessionApp.profilePage.nameInput,
          ).toHaveValue(userOne.name);
        },
      );

      await test.step(
        "Первый пользователь выходит из аккаунта",
        async () => {
          await header.logout();
          await expect(header.loginLink).toBeVisible();
        },
      );

      await test.step(
        "В том же context входит второй пользователь",
        async () => {
          await authPage.gotoLogin();
          await authPage.login(
            userTwo.email,
            userTwo.password,
          );
          await expect(sessionApp.page).toHaveURL(CATALOG_URL);
        },
      );

      await test.step(
        "Профиль принадлежит второму пользователю без данных первого",
        async () => {
          await sessionApp.profilePage.goto();
          await expect(sessionApp.page).toHaveURL(PROFILE_URL);
          await expect(
            sessionApp.profilePage.nameInput,
          ).toHaveValue(userTwo.name);
          await expect(
            sessionApp.profilePage.nameInput,
          ).not.toHaveValue(userOne.name);
        },
      );
    },
  );
});
