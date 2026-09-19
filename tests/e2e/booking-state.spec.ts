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

    await registerUserViaApi(hostApp.context.request, host);
    await hostApp.profilePage.goto();
    await hostApp.profilePage.addSkill(skill, "can_help");
    await hostApp.slotsPage.goto();
    await hostApp.slotsPage.addSlot("16:00");

    await registerUserViaApi(guestApp.context.request, guest);
    await guestApp.bookingPage.goToCatalog();
    await guestApp.bookingPage.searchCatalog(skill);
    await guestApp.bookingPage.waitForPersonInCatalog(host.name, skill);
    await guestApp.bookingPage.openPerson(host.name);
    await guestApp.bookingPage.pickOnlyAvailableSlot();
    await guestApp.bookingPage.confirmBooking();

    expect(
      await guestApp.bookingPage.waitForBookingResult(),
    ).toEqual({ status: "success" });

    await expect
      .poll(
        async () => {
          await guestApp.page.reload();
          return guestApp.bookingPage.availableDayButtons.count();
        },
        {
          timeout: 15_000,
          intervals: [500, 1_000, 2_000],
        },
      )
      .toBe(0);
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

    await registerUserViaApi(hostApp.context.request, host);
    await hostApp.profilePage.goto();
    await hostApp.profilePage.addSkill(skill, "can_help");
    await hostApp.slotsPage.goto();
    await hostApp.slotsPage.addSlot("14:00");

    await registerUserViaApi(guestApp.context.request, guest);
    await guestApp.bookingPage.goToCatalog();
    await guestApp.bookingPage.searchCatalog(skill);
    await guestApp.bookingPage.waitForPersonInCatalog(host.name, skill);
    await guestApp.bookingPage.openPerson(host.name);
    await guestApp.bookingPage.pickOnlyAvailableSlot();

    await expect(guestApp.bookingPage.confirmDialog).toBeVisible();
    await guestApp.bookingPage.dismissBooking();

    await expect(guestApp.bookingPage.confirmDialog).toBeHidden();

    await guestApp.bookingPage.goToBookings();
    await expect(
      guestApp.bookingPage.upcomingBookingByParticipant(host.name),
    ).toHaveCount(0);

    await guestApp.bookingPage.goToCatalog();
    await guestApp.bookingPage.searchCatalog(skill);
    await guestApp.bookingPage.waitForPersonInCatalog(host.name, skill);
    await expect(
      guestApp.bookingPage.personCard(host.name),
    ).toBeVisible();
  });
});
