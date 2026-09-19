import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

test("хост отменяет встречу, и отмену видят обе стороны", async ({
  appFactory,
}) => {
  test.setTimeout(120_000);

  const runId = makeRunId("host-cancel");
  const host = makeUser("host-cancel-host", runId);
  const guest = makeUser("host-cancel-guest", runId);
  const skill = `HostCancel-${runId}`;
  const hostApp = await appFactory();
  const guestApp = await appFactory();

  await registerUserViaApi(hostApp.context.request, host);
  await hostApp.profilePage.goto();
  await hostApp.profilePage.addSkill(skill, "can_help");
  await hostApp.slotsPage.goto();
  await hostApp.slotsPage.addSlot("13:00");

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
        await hostApp.bookingPage.goToBookings();
        return hostApp.bookingPage
          .upcomingBookingByParticipant(guest.name)
          .count();
      },
      {
        timeout: 15_000,
        intervals: [500, 1_000, 2_000],
      },
    )
    .toBe(1);

  await hostApp.bookingPage.cancelBookingWith(guest.name);

  await expect
    .poll(
      async () => {
        await hostApp.page.reload();
        return hostApp.bookingPage
          .pastBookingByParticipant(guest.name)
          .count();
      },
      {
        timeout: 15_000,
        intervals: [500, 1_000, 2_000],
      },
    )
    .toBe(1);

  await expect(
    hostApp.bookingPage.pastBookingByParticipant(guest.name),
  ).toContainText("отменено");
  await expect(
    hostApp.bookingPage
      .pastBookingByParticipant(guest.name)
      .getByRole("button", { name: "Отменить" }),
  ).toHaveCount(0);

  await guestApp.bookingPage.goToBookings();
  await expect
    .poll(
      () =>
        guestApp.bookingPage
          .pastBookingByParticipant(host.name)
          .count(),
      {
        timeout: 15_000,
        intervals: [500, 1_000, 2_000],
      },
    )
    .toBe(1);

  await expect(
    guestApp.bookingPage.upcomingBookingByParticipant(host.name),
  ).toHaveCount(0);
});
