import { expect, test } from "@playwright/test";
import { createHostAndGuestsContexts, closeApps } from "../helpers/booking";
import { makeUser, registerUser } from "../helpers/user";

test.describe("Бронирование встречи", () => {
  test("основной путь и гонка двух гостей за один слот", async ({ browser }) => {
    test.setTimeout(120_000);

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const skillTag = `Playwright-demo-${runId}`;
    const slotTime = "12:00";
    const host = makeUser(`host-${runId}`);
    const guest = makeUser(`guest-${runId}`);
    const guest2 = makeUser(`guest2-${runId}`);

    const { hostApp, guestApp, guest2App } =
      await createHostAndGuestsContexts(browser);

    try {
      await test.step("Хост: регистрируется и публикует навык", async () => {
        await registerUser(hostApp.page, host);
        await hostApp.profilePage.goto();
        await hostApp.profilePage.addSkill(skillTag, "can_help");
      });

      await test.step("Хост: добавляет свободный слот", async () => {
        await hostApp.slotsPage.goto();
        await hostApp.slotsPage.addSlot(slotTime);
      });

      await test.step("Гость: регистрируется и открывает карточку хоста", async () => {
        await registerUser(guestApp.page, guest);
        await guestApp.bookingPage.searchCatalog(skillTag);
        await guestApp.bookingPage.openPerson(host.name);
      });

      await test.step("Открыта карточка нужного хоста", async () => {
        await expect(guestApp.bookingPage.personName).toHaveText(host.name);
      });

      await test.step("Гость: выбирает конкретный слот", async () => {
        await guestApp.bookingPage.pickSlot(slotTime);
      });

      await test.step("Гость2: открывает тот же слот до подтверждения гостя", async () => {
        await registerUser(guest2App.page, guest2);
        await guest2App.bookingPage.searchCatalog(skillTag);
        await guest2App.bookingPage.openPerson(host.name);
        await guest2App.bookingPage.pickSlot(slotTime);
      });

      await test.step("Оба гостя открыли подтверждение одного слота", async () => {
        await expect(guestApp.bookingPage.confirmDialog).toBeVisible();
        await expect(guest2App.bookingPage.confirmDialog).toBeVisible();
      });

      await test.step("Гость: подтверждает первым", async () => {
        await guestApp.bookingPage.confirmBooking();
      });

      await test.step("Первое бронирование успешно", async () => {
        await expect(
          guestApp.bookingPage.confirmSuccess.or(guestApp.bookingPage.confirmError),
        ).toBeVisible({ timeout: 15_000 });
        await expect(guestApp.bookingPage.confirmSuccess).toBeVisible();
      });

      await test.step("Гость2: подтверждает тот же слот вторым", async () => {
        await guest2App.bookingPage.confirmBooking();
      });

      await test.step("Второе бронирование отклонено", async () => {
        await expect(
          guest2App.bookingPage.confirmSuccess.or(guest2App.bookingPage.confirmError),
        ).toBeVisible({ timeout: 15_000 });
        await expect(guest2App.bookingPage.confirmError).toBeVisible();
      });

      await test.step("Гость: открывает свои встречи", async () => {
        await guestApp.bookingPage.goToBookings();
      });

      await test.step("Гость видит встречу с хостом", async () => {
        await expect(
          guestApp.bookingPage.upcomingBookingByParticipant(host.name),
        ).toBeVisible({ timeout: 10_000 });
      });

      await test.step("Хост: открывает свои встречи", async () => {
        await hostApp.bookingPage.goToBookings();
      });

      await test.step("Хост видит встречу с первым гостем", async () => {
        await expect(
          hostApp.bookingPage.upcomingBookingByParticipant(guest.name),
        ).toBeVisible({ timeout: 10_000 });
      });
    } finally {
      await closeApps([hostApp, guestApp, guest2App]);
    }
  });
});
