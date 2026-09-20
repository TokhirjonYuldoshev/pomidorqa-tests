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

  await test.step("Хост публикует слот за час до начала", async () => {
    await registerUserViaApi(hostApp.context.request, host);
    await hostApp.profilePage.goto();
    await hostApp.profilePage.addSkill(skill, "can_help");
    await hostApp.slotsPage.goto();
    await hostApp.slotsPage.addSlot(soon.time, soon.date);
  });

  await test.step("Гость бронирует слот", async () => {
    await registerUserViaApi(guestApp.context.request, guest);
    await guestApp.bookingPage.goToCatalog();
    await guestApp.bookingPage.searchCatalog(skill);
    await guestApp.bookingPage.waitForPersonInCatalog(host.name, skill);
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

  await test.step("Гость открывает свои встречи", async () => {
    await guestApp.bookingPage.goToBookings();
  });

  await test.step("Встреча отображается в ближайших", async () => {
    await expect(
      guestApp.bookingPage.upcomingBookingByParticipant(host.name),
    ).toBeVisible({ timeout: 15_000 });
  });

  await test.step("Гость пытается отменить встречу", async () => {
    await guestApp.bookingPage.submitCancel(host.name);
  });

  await test.step("Поздняя отмена отклонена", async () => {
    await expect(guestApp.bookingPage.cancelError).toBeVisible();
    await expect(
      guestApp.bookingPage.upcomingBookingByParticipant(host.name),
    ).toBeVisible();
    await expect(
      guestApp.bookingPage.pastBookingByParticipant(host.name),
    ).toHaveCount(0);
  });

  await test.step("Хост открывает свои встречи", async () => {
    await hostApp.bookingPage.goToBookings();
  });

  await test.step("У хоста встреча остаётся активной", async () => {
    await expect(
      hostApp.bookingPage.upcomingBookingByParticipant(guest.name),
    ).toBeVisible({ timeout: 15_000 });
  });
});
