import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { startServer, type BookingStore } from "../../src/pyramid/mock-booking-api";

test.describe("API: бронирование слота PomidorQA", () => {
  let store: BookingStore;
  let api: APIRequestContext;
  let close: () => Promise<void>;

  test.beforeAll(async () => {
    const server = await startServer();
    store = server.store;
    close = server.close;
    api = await request.newContext({ baseURL: server.baseURL });
  });

  test.afterAll(async () => {
    await api.dispose();
    await close();
  });

  test("свободный слот бронируется с 201 и confirmed", async () => {
    const slot = store.createSlot("user-host", futureIso(60));
    const response = await api.post("/bookings", {
      data: { slotId: slot.id, userId: "user-guest" },
    });

    expect(response.status()).toBe(201);
    const booking = await response.json();
    expect(booking.status).toBe("confirmed");
    expect(booking.hostId).toBe("user-host");
    expect(booking.guestId).toBe("user-guest");
  });

  test("собственный слот нельзя забронировать", async () => {
    const slot = store.createSlot("user-owner", futureIso(60));
    const response = await api.post("/bookings", {
      data: { slotId: slot.id, userId: "user-owner" },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe("cannot_book_own_slot");
  });

  test("слот в прошлом нельзя забронировать", async () => {
    const slot = store.createSlot("user-host-2", pastIso(60));
    const response = await api.post("/bookings", {
      data: { slotId: slot.id, userId: "user-guest-2" },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe("slot_in_past");
  });

  test("несуществующий слот возвращает 404", async () => {
    const response = await api.post("/bookings", {
      data: { slotId: "no-such-slot-id", userId: "user-guest-3" },
    });

    expect(response.status()).toBe(404);
    expect((await response.json()).error).toBe("slot_not_found");
  });

  test("занятый слот нельзя забронировать повторно", async () => {
    const slot = store.createSlot("user-host-4", futureIso(60));
    await api.post("/bookings", {
      data: { slotId: slot.id, userId: "user-guest-4a" },
    });

    const response = await api.post("/bookings", {
      data: { slotId: slot.id, userId: "user-guest-4b" },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe("slot_already_booked");
  });

  test("в гонке двух броней подтверждается ровно одна", async () => {
    const slot = store.createSlot("user-host-3", futureIso(60));
    const [responseA, responseB] = await Promise.all([
      api.post("/bookings", {
        data: { slotId: slot.id, userId: "user-guest-a" },
      }),
      api.post("/bookings", {
        data: { slotId: slot.id, userId: "user-guest-b" },
      }),
    ]);

    const statuses = [responseA.status(), responseB.status()].sort();
    expect(statuses).toEqual([201, 409]);

    const winner = responseA.status() === 201 ? responseA : responseB;
    const loser = responseA.status() === 201 ? responseB : responseA;
    expect((await winner.json()).status).toBe("confirmed");
    expect((await loser.json()).error).toBe("slot_already_booked");
  });
});

function futureIso(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

function pastIso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}
