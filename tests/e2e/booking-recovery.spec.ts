import { expect, test } from "../fixtures/app-fixtures";
import {
  prepareCatalogParticipant,
} from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

const TEST_TIMEOUT = 180_000;
const CATALOG_RESULT_TIMEOUT = 30_000;

test.describe("Бронирование: восстановление доступности", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  test(
    "после отмены единственного бронирования слот снова доступен другому пользователю",
    async ({ appFactory }) => {
      const runId = makeRunId("booking-recovery");
      const skill = `Recovery-${runId}`;
      const host = makeUser("host", runId);
      const firstGuest = makeUser("first-guest", runId);
      const secondGuest = makeUser("second-guest", runId);

      const hostApp = await appFactory();
      const firstGuestApp = await appFactory();
      const secondGuestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
        "12:00",
      );

      await registerUserViaApi(
        firstGuestApp.context.request,
        firstGuest,
      );

      await registerUserViaApi(
        secondGuestApp.context.request,
        secondGuest,
      );

      await test.step(
        "Первый гость: находит хоста и бронирует единственный слот",
        async () => {
          await firstGuestApp.bookingPage.goToCatalog();
          await firstGuestApp.bookingPage.searchCatalog(skill);
          await firstGuestApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );
          await firstGuestApp.bookingPage.openPerson(host.name);
          await firstGuestApp.bookingPage.pickOnlyAvailableSlot();
          await firstGuestApp.bookingPage.confirmBooking();
        },
      );

      await test.step("Первое бронирование успешно", async () => {
        const result =
          await firstGuestApp.bookingPage.waitForBookingResult();

        expect(result.status).toBe("success");
      });

      await test.step(
        "После занятия последнего слота хост исчезает из каталога",
        async () => {
          await expect
            .poll(
              async () => {
                await secondGuestApp.bookingPage.goToCatalog();
                await secondGuestApp.bookingPage.searchCatalog(skill);

                return secondGuestApp.bookingPage
                  .personCard(host.name)
                  .count();
              },
              {
                timeout: CATALOG_RESULT_TIMEOUT,
                intervals: [500, 1_000, 2_000],
              },
            )
            .toBe(0);
        },
      );

      await test.step(
        "Первый гость: открывает встречи и отменяет бронь",
        async () => {
          await firstGuestApp.bookingPage.goToBookings();

          await expect(
            firstGuestApp.bookingPage.upcomingBookingByParticipant(
              host.name,
            ),
          ).toBeVisible({ timeout: 10_000 });

          await firstGuestApp.bookingPage.cancelBookingWith(
            host.name,
          );
        },
      );

      await test.step(
        "После отмены встреча находится в отменённых у первого гостя",
        async () => {
          await expect(
            firstGuestApp.bookingPage.pastBookingByParticipant(
              host.name,
            ),
          ).toContainText("отменено", {
            timeout: 10_000,
          });

          await expect(
            firstGuestApp.bookingPage.upcomingBookingByParticipant(
              host.name,
            ),
          ).toHaveCount(0);
        },
      );

      await test.step(
        "После отмены хост снова появляется в каталоге",
        async () => {
          await secondGuestApp.bookingPage.goToCatalog();
          await secondGuestApp.bookingPage.searchCatalog(skill);
          await secondGuestApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );

          await expect(
            secondGuestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );

      await test.step(
        "Второй гость: бронирует освобождённый слот",
        async () => {
          await secondGuestApp.bookingPage.openPerson(host.name);
          await secondGuestApp.bookingPage.pickOnlyAvailableSlot();
          await secondGuestApp.bookingPage.confirmBooking();
        },
      );

      await test.step(
        "Освобождённый слот успешно бронируется вторым гостем",
        async () => {
          const result =
            await secondGuestApp.bookingPage.waitForBookingResult();

          expect(result.status).toBe("success");
        },
      );

      await test.step(
        "Второй гость видит новую встречу с тем же хостом",
        async () => {
          await secondGuestApp.bookingPage.goToBookings();

          await expect(
            secondGuestApp.bookingPage.upcomingBookingByParticipant(
              host.name,
            ),
          ).toBeVisible({ timeout: 10_000 });
        },
      );
    },
  );
});
