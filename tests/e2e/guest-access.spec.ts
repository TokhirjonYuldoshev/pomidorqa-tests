import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";
import { PersonPage } from "../pages/person-page";

test.describe("Гостевой доступ", () => {
  test("гость видит профиль и слот, но не может создать бронь", async ({
    appFactory,
  }) => {
    test.setTimeout(120_000);

    const runId = makeRunId("guest-access");
    const host = makeUser("guest-host", runId);
    const skill = `GuestView-${runId}`;
    const hostApp = await appFactory();
    const guestApp = await appFactory();
    const person = new PersonPage(guestApp.page);

    await test.step("Хост публикует навык и свободный слот", async () => {
      await registerUserViaApi(hostApp.context.request, host);
      await hostApp.profilePage.goto();
      await hostApp.profilePage.addSkill(skill, "can_help");
      await hostApp.slotsPage.goto();
      await hostApp.slotsPage.addSlot("17:00");
    });

    await test.step("Гость открывает профиль хоста из каталога", async () => {
      await guestApp.bookingPage.goToCatalog();
      await guestApp.bookingPage.searchCatalog(skill);
      await guestApp.bookingPage.waitForPersonInCatalog(
        host.name,
        skill,
      );
      await guestApp.bookingPage.openPerson(host.name);
    });

    await test.step("Публичная страница показывает имя, навык и слот", async () => {
      await expect(person.name).toHaveText(host.name);
      await expect(person.canHelpSection).toContainText(skill);
      await expect(
        guestApp.bookingPage.availableDayButtons,
      ).toHaveCount(1);
    });

    await test.step("Гость выбирает слот и подтверждает", async () => {
      await guestApp.bookingPage.pickOnlyAvailableSlot();
      await guestApp.bookingPage.confirmBooking();
    });

    await test.step("Сервис требует авторизацию", async () => {
      await expect(guestApp.bookingPage.confirmError).toContainText(
        "Нужно войти в аккаунт PomidorQA",
      );
      await expect(guestApp.bookingPage.confirmSuccess).toHaveCount(0);
    });

    await test.step(
      "После отказа слот остаётся свободным и доступным для бронирования",
      async () => {
        await guestApp.page.reload();

        await expect(
          guestApp.bookingPage.availableDayButtons,
        ).toHaveCount(1);

        await guestApp.bookingPage.openFirstAvailableDay();

        await expect(
          guestApp.bookingPage.availableTimeButton("17:00"),
        ).toBeVisible();
      },
    );
  });
});
