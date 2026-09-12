import { expect, test } from "../fixtures/app-fixtures";
import type { AppContext } from "../helpers/booking";
import {
  addFutureSlot,
  prepareCatalogParticipant,
} from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

const TEST_TIMEOUT = 180_000;
const CATALOG_RESULT_TIMEOUT = 30_000;

async function bookParticipant(
  bookerApp: AppContext,
  hostName: string,
  skill: string,
  slotTime?: string,
): Promise<"success" | "error"> {
  await bookerApp.bookingPage.goToCatalog();
  await bookerApp.bookingPage.searchCatalog(skill);
  await bookerApp.bookingPage.waitForPersonInCatalog(
    hostName,
    skill,
    CATALOG_RESULT_TIMEOUT,
  );
  await bookerApp.bookingPage.openPerson(hostName);

  if (slotTime) {
    await bookerApp.bookingPage.pickAvailableSlotByTime(
      slotTime,
    );
  } else {
    await bookerApp.bookingPage.pickOnlyAvailableSlot();
  }

  await bookerApp.bookingPage.confirmBooking();

  const result =
    await bookerApp.bookingPage.waitForBookingResult();

  return result.status;
}

async function catalogCount(
  app: AppContext,
  name: string,
  skill: string,
): Promise<number> {
  await app.bookingPage.goToCatalog();
  await app.bookingPage.searchCatalog(skill);

  return app.bookingPage.personCard(name).count();
}

test.describe("Каталог: доступность после бронирования", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  test(
    "после бронирования единственного слота участник исчезает из каталога",
    async ({ appFactory }) => {
      const runId = makeRunId("book-last-slot");
      const skill = `BookLast-${runId}`;
      const host = makeUser("book-last-host", runId);
      const booker = makeUser("booker", runId);

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

      let bookingStatus: "success" | "error" = "error";

      await test.step(
        "Гость: бронирует единственный свободный слот",
        async () => {
          bookingStatus = await bookParticipant(
            bookerApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Бронирование единственного слота успешно",
        async () => {
          expect(bookingStatus).toBe("success");
        },
      );

      await test.step(
        "После занятия последнего слота участник исчезает из каталога",
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
    },
  );

  test(
    "после бронирования одного из двух слотов участник остаётся в каталоге",
    async ({ appFactory }) => {
      const runId = makeRunId("book-one-of-two");
      const skill = `TwoSlots-${runId}`;
      const host = makeUser("two-slots-host", runId);
      const booker = makeUser("booker", runId);

      const hostApp = await appFactory();
      const bookerApp = await appFactory();
      const observerApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
        "12:00",
      );

      await addFutureSlot(
        hostApp,
        host.name,
        "13:00",
      );

      await registerUserViaApi(
        bookerApp.context.request,
        booker,
      );

      let bookingStatus: "success" | "error" = "error";

      await test.step(
        "Гость: бронирует слот 12:00, оставляя второй свободным",
        async () => {
          bookingStatus = await bookParticipant(
            bookerApp,
            host.name,
            skill,
            "12:00",
          );
        },
      );

      await test.step(
        "Бронирование одного из двух слотов успешно",
        async () => {
          expect(bookingStatus).toBe("success");
        },
      );

      await test.step(
        "Участник остаётся в каталоге, пока есть второй свободный слот",
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
