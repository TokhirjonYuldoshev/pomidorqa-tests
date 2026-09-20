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
    "после отмены освобождённый слот успешно бронируется другим пользователем",
    async ({ appFactory }) => {
      const runId = makeRunId("cancel-restores-slot");
      const skill = `CancelRestore-${runId}`;
      const host = makeUser("cancel-restore-host", runId);
      const firstBooker = makeUser("first-booker", runId);
      const secondBooker = makeUser("second-booker", runId);

      const hostApp = await appFactory();
      const firstBookerApp = await appFactory();
      const secondBookerApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
        "12:00",
      );

      await registerUserViaApi(
        firstBookerApp.context.request,
        firstBooker,
      );

      await registerUserViaApi(
        secondBookerApp.context.request,
        secondBooker,
      );

      await test.step(
        "Первый пользователь: находит хоста и бронирует единственный слот",
        async () => {
          await firstBookerApp.bookingPage.goToCatalog();
          await firstBookerApp.bookingPage.searchCatalog(skill);
          await firstBookerApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );
          await firstBookerApp.bookingPage.openPerson(host.name);
          await firstBookerApp.bookingPage.pickOnlyAvailableSlot();
          await firstBookerApp.bookingPage.confirmBooking();
        },
      );

      const firstBookingResult = await test.step(
        "Получаем результат первого бронирования",
        async () => firstBookerApp.bookingPage.waitForBookingResult(),
      );

      await test.step(
        "Первое бронирование единственного слота успешно",
        async () => {
          expect(firstBookingResult.status).toBe("success");
        },
      );

      await test.step(
        "После первого бронирования участник исчезает из каталога",
        async () => {
          await expect
            .poll(
              () => catalogCount(
                secondBookerApp,
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
        "Первый пользователь: отменяет встречу с хостом — действие 1",
        async () => {
          await firstBookerApp.bookingPage.goToBookings();
        },
      );

      await test.step("Первый пользователь: отменяет встречу с хостом — проверка", async () => {
        await expect(
          firstBookerApp.bookingPage.upcomingBookingByParticipant(
            host.name,
          ),
        ).toBeVisible({ timeout: 10_000 });
      });

      await test.step(
        "Первый пользователь: отменяет встречу с хостом — действие 2",
        async () => {
          await firstBookerApp.bookingPage.cancelBookingWith(
            host.name,
          );
        },
      );

      await test.step(
        "После отмены участник снова появляется в каталоге — действие",
        async () => {
          await secondBookerApp.bookingPage.goToCatalog();
          await secondBookerApp.bookingPage.searchCatalog(skill);
          await secondBookerApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );
        },
      );

      await test.step(
        "После отмены участник снова появляется в каталоге — проверка",
        async () => {
          await expect(
            secondBookerApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );

      await test.step(
        "Второй пользователь: открывает хоста и бронирует освобождённый слот",
        async () => {
          await secondBookerApp.bookingPage.openPerson(host.name);
          await secondBookerApp.bookingPage.pickOnlyAvailableSlot();
          await secondBookerApp.bookingPage.confirmBooking();
        },
      );

      const secondBookingResult = await test.step(
        "Получаем результат повторного бронирования",
        async () => secondBookerApp.bookingPage.waitForBookingResult(),
      );

      await test.step(
        "Повторное бронирование освобождённого слота успешно",
        async () => {
          expect(secondBookingResult.status).toBe("success");
        },
      );

      await test.step(
        "Второй пользователь видит новую встречу с тем же хостом — действие",
        async () => {
          await secondBookerApp.bookingPage.goToBookings();
        },
      );

      await test.step(
        "Второй пользователь видит новую встречу с тем же хостом — проверка",
        async () => {
          await expect(
            secondBookerApp.bookingPage.upcomingBookingByParticipant(
              host.name,
            ),
          ).toBeVisible({ timeout: 10_000 });
        },
      );
    },
  );
});
