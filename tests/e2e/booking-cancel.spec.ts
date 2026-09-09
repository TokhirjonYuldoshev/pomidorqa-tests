import { expect, test } from "../fixtures/app-fixtures";
import { waitForCatalogParticipant } from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import { makeUser, registerUser } from "../helpers/user";
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
    test.setTimeout(180_000);

    const runId = makeRunId("booking-cancel");
    const skillTag = `Cancel-${runId}`;
    const hostUser = makeUser("host", runId);
    const guestUser = makeUser("guest", runId);

    await test.step(
      "Хост: регистрируется и добавляет уникальный навык",
      async () => {
        await registerUser(hostApp.page, hostUser);

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

    await waitForCatalogParticipant(
      guestApp,
      hostUser,
      skillTag,
    );

    await test.step(
      "Гость: регистрируется и находит хоста по уникальному навыку",
      async () => {
        await registerUser(guestApp.page, guestUser);

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

    await test.step(
      "Бронирование прошло успешно",
      async () => {
        const bookingResult =
          await guestApp.bookingPage.waitForBookingResult();

        const failureMessage =
          bookingResult.status === "error"
            ? `Бронирование не удалось: ${bookingResult.message}`
            : "Бронирование должно завершиться успешно";

        expect(
          bookingResult.status,
          failureMessage,
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
