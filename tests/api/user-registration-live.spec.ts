import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from "@playwright/test";
import {
  deleteUserViaApi,
  makeUser,
  registerUserViaApi,
} from "../helpers/user";
import { makeRunId } from "../helpers/test-data";

test.describe("API: регистрация на live PomidorQA", () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({
      baseURL: process.env.POMIDORQA_BASE_URL ?? "https://aiqa.su",
    });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("новый участник создаётся с переданными данными", async () => {
    const user = makeUser("api-reg", makeRunId("api-reg"));

    try {
      const participant = await registerUserViaApi(api, user);

      expect(participant.name).toBe(user.name);
      expect(participant.email).toBe(user.email);
      expect(participant.id).toBeTruthy();
    } finally {
      await deleteUserViaApi(api);
    }
  });

  test("повторный email возвращает 409 email_taken", async () => {
    const user = makeUser(
      "api-duplicate",
      makeRunId("api-duplicate"),
    );

    try {
      await registerUserViaApi(api, user);

      const response = await api.post(
        "/api/pomidorqa/test/accounts",
        { data: user },
      );

      expect(response.status()).toBe(409);
      expect(await response.json()).toMatchObject({
        error: "email_taken",
      });
    } finally {
      await deleteUserViaApi(api);
    }
  });

  test("короткий пароль отклоняется сервером", async () => {
    const user = {
      ...makeUser("api-short-pass", makeRunId("api-short-pass")),
      password: "short",
    };

    const response = await api.post(
      "/api/pomidorqa/test/accounts",
      { data: user },
    );

    expect(response.status()).toBe(400);
  });
});
