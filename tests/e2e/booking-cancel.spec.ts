import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import { makeUser, registerUserViaApi } from "../helpers/user";
import { AuthPage } from "../pages/auth-page";
import type { BookingPage } from "../pages/booking-page";

async function expectBookingCancelledFor(
  bookingPage: BookingPage,
  participantName: string,
) {
  const cancelledMeeting =
    bookingPage.pastBookingByParticipant(participantName);

  // Сначала ждём положительный признак загрузившегося состояния.
  // Это важнее, чем начинать с toHaveCount(0), который может пройти
  // преждевременно на ещё не загруженной странице.
  await expect(cancelledMeeting).toBeVisible({
    timeout: 10_000,
  });

  await expect(cancelledMeeting).toContainText("отменено");

  await expect(
    bookingPage.upcomingBookingByParticipant(participantName),
  ).toHaveCount(0);
}

test(
  "гость отменяет встречу — после reload отмену видят гость и хост",
  async ({ hostApp, guestApp }) => {
    test.setTimeout(120_000);

    const runId = makeRunId("booking-cancel");
    const skillTag = `Cancel-${runId}`;
    const hostUser = makeUser("host", runId);
    const guestUser = makeUser("guest", runId);

    await test.step(
      "Arrange: создаём аккаунт хоста через API и выполняем вход",
      async () => {
        await registerUserViaApi(
          hostApp.context.request,
          hostUser,
        );
        const hostAuthPage = new AuthPage(hostApp.page);
        await hostAuthPage.gotoLogin();
        await hostAuthPage.login(
          hostUser.email,
          hostUser.password,
        );
      },
    );

    await test.step(
      "Хост: добавляет уникальный навык",
      async () => {
        await hostApp.profilePage.goto();
        await hostApp.profilePage.addSkill(
          skillTag,
          "can_help",
        );
      },
    );

    await test.step(
      "Хост: добавляет свободный слот на завтра",
      async () => {
        await hostApp.slotsPage.goto();

        await hostApp.slotsPage.addSlot("12:00");
      },
    );

    await test.step(
      "Arrange: создаём аккаунт гостя через API и выполняем вход",
      async () => {
        await registerUserViaApi(
          guestApp.context.request,
          guestUser,
        );
        const guestAuthPage = new AuthPage(guestApp.page);
        await guestAuthPage.gotoLogin();
        await guestAuthPage.login(
          guestUser.email,
          guestUser.password,
        );
      },
    );

    await test.step(
      "Гость: находит хоста по уникальному навыку",
      async () => {
        await guestApp.bookingPage.searchCatalog(skillTag);
        await guestApp.bookingPage.openPerson(
          hostUser.name,
        );
      },
    );

    await test.step(
      "Гость: выбирает единственный созданный слот",
      async () => {
        await guestApp.bookingPage.pickOnlyAvailableSlot();
      },
    );

    await test.step(
      "Открылось подтверждение бронирования",
      async () => {
        await expect(
          guestApp.bookingPage.confirmDialog,
        ).toBeVisible({
          timeout: 10_000,
        });
      },
    );

    await test.step(
      "Гость: подтверждает бронирование",
      async () => {
        await guestApp.bookingPage.confirmBooking();
      },
    );

    const bookingResult = await test.step(
      "Получаем результат бронирования",
      async () => guestApp.bookingPage.waitForBookingResult(),
    );

    await test.step(
      "Бронирование прошло успешно",
      async () => {
        expect(
          bookingResult.status,
          bookingResult.status === "error"
            ? `Бронирование не удалось: ${bookingResult.message}`
            : "Бронирование должно завершиться успешно",
        ).toBe("success");
      },
    );

    await test.step(
      "Гость: открывает свои встречи",
      async () => {
        await guestApp.bookingPage.goToBookings();
      },
    );

    await test.step(
      "Гость видит встречу именно с этим хостом",
      async () => {
        await expect(
          guestApp.bookingPage.upcomingBookingByParticipant(
            hostUser.name,
          ),
        ).toBeVisible();
      },
    );

    await test.step(
      "Гость: отменяет встречу именно с этим хостом",
      async () => {
        await guestApp.bookingPage.cancelBookingWith(
          hostUser.name,
        );
      },
    );

    await test.step(
      "После отмены встреча исчезла из ближайших и появилась в отменённых",
      async () => {
        await expectBookingCancelledFor(
          guestApp.bookingPage,
          hostUser.name,
        );
      },
    );

    await test.step(
      "Гость: перезагружает страницу встреч",
      async () => {
        await guestApp.page.reload();
      },
    );

    await test.step(
      "После reload гость по-прежнему видит отмену",
      async () => {
        await expectBookingCancelledFor(
          guestApp.bookingPage,
          hostUser.name,
        );
      },
    );

    await test.step(
      "Хост: открывает свои встречи",
      async () => {
        await hostApp.bookingPage.goToBookings();
      },
    );

    await test.step(
      "Хост: перезагружает страницу встреч",
      async () => {
        await hostApp.page.reload();
      },
    );

    await test.step(
      "После reload хост видит отменённую встречу именно с этим гостем",
      async () => {
        await expectBookingCancelledFor(
          hostApp.bookingPage,
          guestUser.name,
        );
      },
    );
  },
);
