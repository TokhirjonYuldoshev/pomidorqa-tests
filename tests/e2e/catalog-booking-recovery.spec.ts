import { expect, test } from "../fixtures/app-fixtures";
import type { AppContext } from "../helpers/booking";
import { prepareCatalogParticipant } from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

const TEST_TIMEOUT = 180_000;
const CATALOG_RESULT_TIMEOUT = 30_000;

async function catalogCount(
  app: AppContext,
  participantName: string,
  skill: string,
): Promise<number> {
  await app.bookingPage.goToCatalog();
  await app.bookingPage.searchCatalog(skill);

  return app.bookingPage.personCard(participantName).count();
}

test.describe("Каталог: восстановление доступности", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  test(
    "после отмены бронирования единственный слот снова делает участника доступным",
    async ({ appFactory }) => {
      const runId = makeRunId("cancel-restores-slot");
      const skill = `CancelRestore-${runId}`;
      const host = makeUser("cancel-restore-host", runId);
      const booker = makeUser("cancel-restore-booker", runId);

      const hostApp = await appFactory();
      const bookerApp = await appFactory();
      const observerApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
        "12:00",
      );

      await registerUserViaApi(
        bookerApp.context.request,
        booker,
      );

      await test.step(
        "Гость: находит хоста и бронирует единственный слот",
        async () => {
          await bookerApp.bookingPage.goToCatalog();
          await bookerApp.bookingPage.searchCatalog(skill);
          await bookerApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );
          await bookerApp.bookingPage.openPerson(host.name);
          await bookerApp.bookingPage.pickOnlyAvailableSlot();
          await bookerApp.bookingPage.confirmBooking();
        },
      );

      await test.step(
        "Бронирование единственного слота успешно",
        async () => {
          const result =
            await bookerApp.bookingPage.waitForBookingResult();

          expect(result.status).toBe("success");
        },
      );

      await test.step(
        "После бронирования участник исчезает из каталога",
        async () => {
          await expect
            .poll(
              () => catalogCount(
                observerApp,
                host.name,
                skill,
              ),
              {
                timeout: CATALOG_RESULT_TIMEOUT,
                intervals: [500, 1_000, 2_000],
              },
            )
            .toBe(0);
        },
      );

      await test.step(
        "Гость: отменяет встречу с хостом",
        async () => {
          await bookerApp.bookingPage.goToBookings();

          await expect(
            bookerApp.bookingPage.upcomingBookingByParticipant(
              host.name,
            ),
          ).toBeVisible({ timeout: 10_000 });

          await bookerApp.bookingPage.cancelBookingWith(
            host.name,
          );
        },
      );

      await test.step(
        "После отмены участник снова появляется в каталоге",
        async () => {
          await observerApp.bookingPage.goToCatalog();
          await observerApp.bookingPage.searchCatalog(skill);
          await observerApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );

          await expect(
            observerApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );
});
