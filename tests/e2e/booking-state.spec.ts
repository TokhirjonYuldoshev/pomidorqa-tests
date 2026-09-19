import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

test.describe("Бронирование: состояние слота и модалки", () => {
  test("после брони слот исчезает из публичной доступности", async ({
    appFactory,
  }) => {
    test.setTimeout(120_000);

    const runId = makeRunId("booking-state");
    const host = makeUser("booking-state-host", runId);
    const guest = makeUser("booking-state-guest", runId);
    const skill = `BookingState-${runId}`;
    const hostApp = await appFactory();
    const guestApp = await appFactory();

    await test.step("Хост публикует навык и свободный слот", async () => {
      await registerUserViaApi(hostApp.context.request, host);
      await hostApp.profilePage.goto();
      await hostApp.profilePage.addSkill(skill, "can_help");
      await hostApp.slotsPage.goto();
      await hostApp.slotsPage.addSlot("16:00");
    });

    await test.step("Гость бронирует опубликованный слот", async () => {
      await registerUserViaApi(guestApp.context.request, guest);
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skill);
      await guestApp.bookingPage.waitForPersonInCatalog(host.name, skill);
      await guestApp.bookingPage.openPerson(host.name);
      await guestApp.bookingPage.pickOnlyAvailableSlot();
      await guestApp.bookingPage.confirmBooking();
    });

    await test.step("Бронирование подтверждено", async () => {
      expect(
        await guestApp.bookingPage.waitForBookingResult(),
      ).toEqual({ status: "success" });
    });

    await test.step("Гость обновляет страницу участника", async () => {
      await guestApp.page.reload();
    });

    await test.step("Забронированный слот больше не доступен", async () => {
      await expect(
        guestApp.bookingPage.availableDayButtons,
      ).toHaveCount(0);
    });
  });

  test("закрытие подтверждения не создаёт бронирование", async ({
    appFactory,
  }) => {
    test.setTimeout(120_000);

    const runId = makeRunId("dismiss-booking");
    const host = makeUser("dismiss-host", runId);
    const guest = makeUser("dismiss-guest", runId);
    const skill = `Dismiss-${runId}`;
    const hostApp = await appFactory();
    const guestApp = await appFactory();

    await test.step("Хост публикует навык и свободный слот", async () => {
      await registerUserViaApi(hostApp.context.request, host);
      await hostApp.profilePage.goto();
      await hostApp.profilePage.addSkill(skill, "can_help");
      await hostApp.slotsPage.goto();
      await hostApp.slotsPage.addSlot("14:00");
    });

    await test.step("Гость открывает подтверждение бронирования", async () => {
      await registerUserViaApi(guestApp.context.request, guest);
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skill);
      await guestApp.bookingPage.waitForPersonInCatalog(host.name, skill);
      await guestApp.bookingPage.openPerson(host.name);
      await guestApp.bookingPage.pickOnlyAvailableSlot();
    });

    await test.step("Диалог подтверждения открыт", async () => {
      await expect(guestApp.bookingPage.confirmDialog).toBeVisible();
    });

    await test.step("Гость закрывает подтверждение", async () => {
      await guestApp.bookingPage.dismissBooking();
    });

    await test.step("Диалог подтверждения закрыт", async () => {
      await expect(guestApp.bookingPage.confirmDialog).toBeHidden();
    });

    await test.step("Гость открывает свои встречи", async () => {
      await guestApp.bookingPage.goToBookings();
    });

    await test.step("Новая встреча не появилась", async () => {
      await expect(
        guestApp.bookingPage.upcomingBookingByParticipant(host.name),
      ).toHaveCount(0);
    });

    await test.step("Гость снова ищет хоста", async () => {
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skill);
      await guestApp.bookingPage.waitForPersonInCatalog(host.name, skill);
    });

    await test.step("Хост остаётся доступен для бронирования", async () => {
      await expect(
        guestApp.bookingPage.personCard(host.name),
      ).toBeVisible();
    });
  });
});
