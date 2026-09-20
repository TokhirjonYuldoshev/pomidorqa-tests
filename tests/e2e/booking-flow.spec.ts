import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import { makeUser, registerUserViaApi } from "../helpers/user";

test.describe("Бронирование встречи", () => {
  test(
    "основной путь и гонка двух гостей за один слот",
    async ({ hostApp, guestApp, guest2App }) => {
      test.setTimeout(120_000);

      const runId = makeRunId("booking-flow");
      const skillTag = `Playwright-demo-${runId}`;
      const slotTime = "12:00";
      const host = makeUser("host", runId);
      const guest = makeUser("guest", runId);
      const guest2 = makeUser("guest2", runId);

      await test.step(
        "Хост: создаёт аккаунт через API и публикует навык",
        async () => {
          await registerUserViaApi(
            hostApp.context.request,
            host,
          );
          await hostApp.profilePage.goto();
          await hostApp.profilePage.addSkill(
            skillTag,
            "can_help",
          );
        },
      );

      await test.step(
        "Хост: добавляет свободный слот",
        async () => {
          await hostApp.slotsPage.goto();
          await hostApp.slotsPage.addSlot(slotTime);
        },
      );

      await test.step(
        "Гость: создаёт аккаунт через API и открывает карточку хоста",
        async () => {
          await registerUserViaApi(
            guestApp.context.request,
            guest,
          );
          await guestApp.bookingPage.goToCatalog();
          await guestApp.bookingPage.searchCatalog(skillTag);
          await guestApp.bookingPage.openPerson(host.name);
        },
      );

      await test.step(
        "Открыта карточка нужного хоста",
        async () => {
          await expect(
            guestApp.bookingPage.personName,
          ).toHaveText(host.name);
        },
      );

      await test.step(
        "Гость: выбирает единственный созданный свободный слот",
        async () => {
          await guestApp.bookingPage.pickOnlyAvailableSlot();
        },
      );

      await test.step(
        "Гость2: создаёт аккаунт через API и открывает тот же слот",
        async () => {
          await registerUserViaApi(
            guest2App.context.request,
            guest2,
          );
          await guest2App.bookingPage.goToCatalog();
          await guest2App.bookingPage.searchCatalog(skillTag);
          await guest2App.bookingPage.openPerson(host.name);
          await guest2App.bookingPage.pickOnlyAvailableSlot();
        },
      );

      await test.step(
        "Оба гостя открыли подтверждение одного слота",
        async () => {
          await expect(
            guestApp.bookingPage.confirmDialog,
          ).toBeVisible();

          await expect(
            guest2App.bookingPage.confirmDialog,
          ).toBeVisible();
        },
      );

      await test.step(
        "Гость: подтверждает первым",
        async () => {
          await guestApp.bookingPage.confirmBooking();
        },
      );

      await test.step(
        "Первое бронирование успешно",
        async () => {
          await expect(
            guestApp.bookingPage.confirmSuccess.or(
              guestApp.bookingPage.confirmError,
            ),
          ).toBeVisible({
            timeout: 15_000,
          });

          await expect(
            guestApp.bookingPage.confirmSuccess,
          ).toBeVisible();
        },
      );

      await test.step(
        "Гость2: подтверждает тот же слот вторым",
        async () => {
          await guest2App.bookingPage.confirmBooking();
        },
      );

      await test.step(
        "Второе бронирование отклонено",
        async () => {
          await expect(
            guest2App.bookingPage.confirmSuccess.or(
              guest2App.bookingPage.confirmError,
            ),
          ).toBeVisible({
            timeout: 15_000,
          });

          await expect(
            guest2App.bookingPage.confirmError,
          ).toBeVisible();
        },
      );

      await test.step(
        "Гость: открывает свои встречи",
        async () => {
          await guestApp.bookingPage.goToBookings();
        },
      );

      await test.step(
        "Гость видит встречу с хостом",
        async () => {
          await expect(
            guestApp.bookingPage.upcomingBookingByParticipant(
              host.name,
            ),
          ).toBeVisible({
            timeout: 10_000,
          });
        },
      );

      await test.step(
        "Хост: открывает свои встречи",
        async () => {
          await hostApp.bookingPage.goToBookings();
        },
      );

      await test.step(
        "Хост видит встречу с первым гостем",
        async () => {
          await expect(
            hostApp.bookingPage.upcomingBookingByParticipant(
              guest.name,
            ),
          ).toBeVisible({
            timeout: 10_000,
          });
        },
      );
    },
  );
});
