import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { startServer } from "../../src/pyramid/mock-booking-api";

test.describe("API: регистрация участника PomidorQA", () => {
  let api: APIRequestContext;
  let close: () => Promise<void>;

  test.beforeAll(async () => {
    const server = await startServer();
    close = server.close;
    api = await request.newContext({ baseURL: server.baseURL });
  });

  test.afterAll(async () => {
    await api.dispose();
    await close();
  });

  test("новый участник создаётся с 201", async () => {
    const email = `new-participant-${Date.now()}@example.com`;
    const response = await api.post("/participants", {
      data: { name: "Новый Участник", email },
    });

    expect(response.status()).toBe(201);
    const participant = await response.json();
    expect(participant.name).toBe("Новый Участник");
    expect(participant.email).toBe(email);
    expect(participant.id).toBeTruthy();
  });

  test("повторный email возвращает 409 email_taken", async () => {
    const email = `duplicate-${Date.now()}@example.com`;
    await api.post("/participants", {
      data: { name: "Первый", email },
    });

    const response = await api.post("/participants", {
      data: { name: "Второй", email },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe("email_taken");
  });
});
