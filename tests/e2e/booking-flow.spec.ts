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
        "Оба гостя одновременно подтверждают один слот",
        async () => {
          await Promise.all([
            guestApp.bookingPage.confirmBooking(),
            guest2App.bookingPage.confirmBooking(),
          ]);
        },
      );

      const [guestResult, guest2Result] = await test.step(
        "Получаем независимые результаты конкурентного бронирования",
        async () =>
          Promise.all([
            guestApp.bookingPage.waitForBookingResult(),
            guest2App.bookingPage.waitForBookingResult(),
          ]),
      );

      await test.step(
        "Ровно одна бронь подтверждена, вторая отклонена с предложением выбрать другой слот",
        async () => {
          expect(
            [guestResult.status, guest2Result.status].sort(),
          ).toEqual(["error", "success"]);

          const rejectedResult =
            guestResult.status === "error"
              ? guestResult
              : guest2Result;

          expect(rejectedResult.status).toBe("error");

          if (rejectedResult.status !== "error") {
            throw new Error(
              "Конкурентное бронирование не вернуло ожидаемую ошибку проигравшему участнику",
            );
          }

          expect(rejectedResult.message).toMatch(
            /выбер|друг/i,
          );
        },
      );

      const winner =
        guestResult.status === "success"
          ? { app: guestApp, user: guest }
          : { app: guest2App, user: guest2 };

      const loser =
        guestResult.status === "error"
          ? { app: guestApp, user: guest }
          : { app: guest2App, user: guest2 };

      await test.step(
        "Победитель гонки открывает свои встречи",
        async () => {
          await winner.app.bookingPage.goToBookings();
        },
      );

      await test.step(
        "У победителя есть ровно одна встреча с хостом",
        async () => {
          await expect(
            winner.app.bookingPage.upcomingBookingByParticipant(
              host.name,
            ),
          ).toHaveCount(1);
        },
      );

      await test.step(
        "Проигравший гонку открывает свои встречи",
        async () => {
          await loser.app.bookingPage.goToBookings();
        },
      );

      await test.step(
        "У проигравшего встреча с хостом не создана",
        async () => {
          await expect(
            loser.app.bookingPage.upcomingBookingByParticipant(
              host.name,
            ),
          ).toHaveCount(0);
        },
      );

      await test.step(
        "Хост открывает свои встречи",
        async () => {
          await hostApp.bookingPage.goToBookings();
        },
      );

      await test.step(
        "У хоста есть встреча только с победителем гонки",
        async () => {
          await expect(
            hostApp.bookingPage.upcomingBookingByParticipant(
              winner.user.name,
            ),
          ).toHaveCount(1);

          await expect(
            hostApp.bookingPage.upcomingBookingByParticipant(
              loser.user.name,
            ),
          ).toHaveCount(0);
        },
      );
    },
  );
});
