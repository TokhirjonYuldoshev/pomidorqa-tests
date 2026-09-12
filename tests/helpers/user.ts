import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { ROUTES } from "./routes";
import { makeUniqueToken } from "./test-data";

const TEST_ACCOUNTS_ROUTE = "/api/pomidorqa/test/accounts";

export type TestUser = {
  name: string;
  email: string;
  password: string;
};

export type RegisteredParticipant = {
  id: string;
  name: string;
  email: string;
};

export function makeUser(
  role: string,
  runId = makeUniqueToken(),
): TestUser {
  return {
    name: `${role} Автотест ${runId}`,
    email: `${role}-${runId}@example.com`,
    password: "testpass123",
  };
}

function isRegisteredParticipant(
  value: unknown,
): value is RegisteredParticipant {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === "string" &&
    (value as Record<string, unknown>).id !== "" &&
    typeof (value as Record<string, unknown>).name === "string" &&
    typeof (value as Record<string, unknown>).email === "string"
  );
}

export async function registerUserViaApi(
  request: APIRequestContext,
  user: TestUser,
): Promise<RegisteredParticipant> {
  const response = await request.post(TEST_ACCOUNTS_ROUTE, {
    data: user,
  });

  if (response.status() !== 201) {
    throw new Error(
      `Регистрация ${user.email} не удалась: ` +
        `${response.status()} ${await response.text()}`,
    );
  }

  try {
    const body: unknown = await response.json();

    if (!isRegisteredParticipant(body)) {
      throw new Error(
        `Ответ регистрации ${user.email} не соответствует контракту ` +
          `RegisteredParticipant (id/name/email): ${JSON.stringify(body)}`,
      );
    }

    return body;
  } catch (setupError) {
    try {
      await deleteUserViaApi(request);
    } catch (cleanupError) {
      throw new AggregateError(
        [setupError, cleanupError],
        `Регистрация ${user.email} создала аккаунт, но проверка ответа и cleanup завершились ошибкой`,
      );
    }

    if (setupError instanceof Error) {
      throw setupError;
    }

    throw new Error(
      `Ответ регистрации ${user.email} не удалось обработать: ${String(setupError)}`,
    );
  }
}

export async function deleteCurrentTestUser(
  request: APIRequestContext,
): Promise<"deleted" | "missing"> {
  const response = await request.delete(TEST_ACCOUNTS_ROUTE);

  if (response.status() === 200) {
    return "deleted";
  }

  if (response.status() === 401 || response.status() === 404) {
    return "missing";
  }

  throw new Error(
    `Cleanup тестового аккаунта не удался: ` +
      `${response.status()} ${await response.text()}`,
  );
}

export async function deleteUserViaApi(
  request: APIRequestContext,
): Promise<void> {
  const result = await deleteCurrentTestUser(request);

  if (result !== "deleted") {
    throw new Error(
      "Удаление аккаунта ожидало авторизованного тестового пользователя, но текущий аккаунт отсутствует",
    );
  }
}

export async function registerUser(
  page: Page,
  user: TestUser,
): Promise<void> {
  await test.step(`Хелпер: Регистрация пользователя ${user.name}`, async () => {
    let registrationPageResponse;

    try {
      registrationPageResponse = await page.goto(ROUTES.register);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Не удалось открыть страницу регистрации для ${user.email}. ` +
          `URL: ${page.url()}. Причина: ${reason}`,
      );
    }

    if (
      registrationPageResponse &&
      registrationPageResponse.status() >= 400
    ) {
      throw new Error(
        `Страница регистрации для ${user.email} вернула ` +
          `HTTP ${registrationPageResponse.status()} ` +
          `${registrationPageResponse.statusText()}`,
      );
    }

    await page.getByLabel("Имя").fill(user.name);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Пароль").fill(user.password);

    const registrationPath = new URL(ROUTES.register, page.url()).pathname;
    const registrationResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === registrationPath,
      { timeout: 15_000 },
    );

    await page
      .getByRole("button", { name: "Зарегистрироваться" })
      .click();

    const registrationResponse = await registrationResponsePromise;

    if (registrationResponse.status() >= 400) {
      throw new Error(
        `Регистрация ${user.email} вернула ` +
          `HTTP ${registrationResponse.status()} ` +
          `${registrationResponse.statusText()}. ` +
          `URL: ${registrationResponse.url()}`,
      );
    }

    await expect(
      page,
      `После регистрации ${user.email} ожидается переход на главную PomidorQA`,
    ).toHaveURL(/\/pomidorqa\/?$/, {
      timeout: 15_000,
    });
  });
}
