import { expect, test } from "../fixtures/app-fixtures";
import { slotFormValues } from "../helpers/slot-time";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

test("за час до начала встречу отменить нельзя", async ({
  appFactory,
}) => {
  test.setTimeout(120_000);

  const runId = makeRunId("cancel-window");
  const host = makeUser("cancel-host", runId);
  const guest = makeUser("cancel-guest", runId);
  const skill = `CancelWindow-${runId}`;
  const soon = slotFormValues(60 * 60 * 1000);
  const hostApp = await appFactory();
  const guestApp = await appFactory();

  await registerUserViaApi(hostApp.context.request, host);
  await hostApp.profilePage.goto();
  await hostApp.profilePage.addSkill(skill, "can_help");
  await hostApp.slotsPage.goto();
  await hostApp.slotsPage.addSlot(soon.time, soon.date);

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
        await guestApp.bookingPage.goToBookings();
        return guestApp.bookingPage
          .upcomingBookingByParticipant(host.name)
          .count();
      },
      {
        timeout: 15_000,
        intervals: [500, 1_000, 2_000],
      },
    )
    .toBe(1);

  await guestApp.bookingPage.submitCancel(host.name);

  await expect(guestApp.bookingPage.cancelError).toBeVisible();
  await expect(
    guestApp.bookingPage.upcomingBookingByParticipant(host.name),
  ).toBeVisible();
  await expect(
    guestApp.bookingPage.pastBookingByParticipant(host.name),
  ).toHaveCount(0);

  await hostApp.bookingPage.goToBookings();
  await expect(
    hostApp.bookingPage.upcomingBookingByParticipant(guest.name),
  ).toBeVisible();
});
