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

  await test.step("Хост публикует навык и свободный слот", async () => {
    await registerUserViaApi(hostApp.context.request, host);
    await hostApp.profilePage.goto();
    await hostApp.profilePage.addSkill(skill, "can_help");
    await hostApp.slotsPage.goto();
    await hostApp.slotsPage.addSlot("13:00");
  });

  await test.step("Гость бронирует слот хоста", async () => {
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

  await test.step("Бронирование гостя подтверждено", async () => {
    expect(bookingResult).toEqual({ status: "success" });
  });

  await test.step("Хост открывает свои встречи", async () => {
    await hostApp.bookingPage.goToBookings();
  });

  await test.step("Хост видит встречу с гостем", async () => {
    await expect(
      hostApp.bookingPage.upcomingBookingByParticipant(guest.name),
    ).toBeVisible({ timeout: 15_000 });
  });

  await test.step("Хост отменяет встречу", async () => {
    await hostApp.bookingPage.cancelBookingWith(guest.name);
    await hostApp.page.reload();
  });

  await test.step("У хоста встреча перенесена в отменённые", async () => {
    await expect(
      hostApp.bookingPage.pastBookingByParticipant(guest.name),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      hostApp.bookingPage.pastBookingByParticipant(guest.name),
    ).toContainText("отменено");
    await expect(
      hostApp.bookingPage.pastBookingCancelButton(guest.name),
    ).toHaveCount(0);
  });

  await test.step("Гость открывает свои встречи", async () => {
    await guestApp.bookingPage.goToBookings();
  });

  await test.step("Гость тоже видит отменённую встречу", async () => {
    await expect(
      guestApp.bookingPage.pastBookingByParticipant(host.name),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      guestApp.bookingPage.upcomingBookingByParticipant(host.name),
    ).toHaveCount(0);
  });
});
