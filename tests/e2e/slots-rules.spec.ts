import { expect, test } from "../fixtures/app-fixtures";
import { slotFormValues } from "../helpers/slot-time";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

test.describe("Слоты: правила MVP", () => {
  test("дату в прошлом форма не отправляет", async ({ appFactory }) => {
    const app = await appFactory();
    const user = makeUser("slot-past", makeRunId("slot-past"));
    const pastDate = slotFormValues(-48 * 60 * 60 * 1000).date;

    await test.step("Открываем слоты зарегистрированного участника", async () => {
      await registerUserViaApi(app.context.request, user);
      await app.slotsPage.goto();
    });

    await test.step("Пытаемся отправить дату в прошлом", async () => {
      await app.slotsPage.submitSlot("12:00", pastDate);
    });

    const pastDateIsValid = await test.step(
      "Считываем browser validation прошлой даты",
      async () =>
        app.slotsPage.dateInput.evaluate(
          (input) => input.validity.valid,
        ),
    );

    await test.step("Форма блокирует прошлую дату и слот не создаётся", async () => {
      expect(pastDateIsValid).toBe(false);
      await expect(app.slotsPage.slotCards).toHaveCount(0);
    });
  });

  test("свободный слот можно удалить, соседний остаётся", async ({
    appFactory,
  }) => {
    const app = await appFactory();
    const user = makeUser("slot-delete", makeRunId("slot-delete"));

    await test.step("Создаём два свободных слота", async () => {
      await registerUserViaApi(app.context.request, user);
      await app.slotsPage.goto();
      await app.slotsPage.addSlot("09:00");
      await app.slotsPage.addSlot("10:00");
    });

    await test.step("Первый слот имеет статус free", async () => {
      await expect(
        app.slotsPage.slotCard("09:00"),
      ).toHaveAttribute("data-slot-status", "free");
    });

    await test.step("Удаляем первый слот и обновляем страницу", async () => {
      await app.slotsPage.deleteSlot("09:00");
      await app.page.reload();
    });

    await test.step("Удалённый слот исчез, соседний остался", async () => {
      await expect(app.slotsPage.slotCard("09:00")).toHaveCount(0);
      await expect(app.slotsPage.slotCard("10:00")).toBeVisible();
    });
  });

  test("забронированный слот имеет status booked и не удаляется из UI", async ({
    appFactory,
  }) => {
    test.setTimeout(120_000);

    const runId = makeRunId("booked-slot");
    const host = makeUser("booked-host", runId);
    const guest = makeUser("booked-guest", runId);
    const skill = `BookedSlot-${runId}`;
    const hostApp = await appFactory();
    const guestApp = await appFactory();

    await test.step("Хост публикует навык и свободный слот", async () => {
      await registerUserViaApi(hostApp.context.request, host);
      await hostApp.profilePage.goto();
      await hostApp.profilePage.addSkill(skill, "can_help");
      await hostApp.slotsPage.goto();
      await hostApp.slotsPage.addSlot("11:00");
    });

    await test.step("До бронирования слот имеет статус free", async () => {
      await expect(
        hostApp.slotsPage.slotCard("11:00"),
      ).toHaveAttribute("data-slot-status", "free");
    });

    await test.step("Гость бронирует слот хоста", async () => {
      await registerUserViaApi(guestApp.context.request, guest);
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skill);
      await guestApp.bookingPage.waitForPersonInCatalog(
        host.name,
        skill,
      );
      await guestApp.bookingPage.openPerson(host.name);
      await guestApp.bookingPage.pickOnlyAvailableSlot();
      await guestApp.bookingPage.confirmBooking();
    });

    const bookingResult = await test.step(
      "Ожидаем результат бронирования",
      async () => guestApp.bookingPage.waitForBookingResult(),
    );

    await test.step("Бронирование подтверждено", async () => {
      expect(bookingResult).toEqual({ status: "success" });
    });

    await test.step("Хост обновляет список слотов", async () => {
      await hostApp.page.reload();
    });

    await test.step("Слот стал booked и недоступен для удаления", async () => {
      await expect(
        hostApp.slotsPage.slotCard("11:00"),
      ).toHaveAttribute("data-slot-status", "booked", {
        timeout: 15_000,
      });
      await expect(
        hostApp.slotsPage.slotDeleteButton("11:00"),
      ).toHaveCount(0);
    });
  });
});
