import { expect, test } from "../fixtures/app-fixtures";
import type { AppContext } from "../helpers/booking";
import {
  addFutureSlot,
  prepareCatalogParticipant,
} from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import {
  deleteUserViaApi,
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

const TEST_TIMEOUT = 240_000;
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
  hostName: string,
  skill: string,
): Promise<number> {
  await app.bookingPage.goToCatalog();
  await app.bookingPage.searchCatalog(skill);

  return app.bookingPage.personCard(hostName).count();
}

async function waitForCatalogAbsence(
  app: AppContext,
  hostName: string,
  skill: string,
): Promise<void> {
  await expect
    .poll(
      () => catalogCount(
        app,
        hostName,
        skill,
      ),
      {
        timeout: CATALOG_RESULT_TIMEOUT,
        intervals: [500, 1_000, 2_000],
      },
    )
    .toBe(0);
}

async function waitForCatalogPresence(
  app: AppContext,
  hostName: string,
  skill: string,
): Promise<void> {
  await app.bookingPage.goToCatalog();
  await app.bookingPage.searchCatalog(skill);
  await app.bookingPage.waitForPersonInCatalog(
    hostName,
    skill,
    CATALOG_RESULT_TIMEOUT,
  );

  await expect(
    app.bookingPage.personCard(hostName),
  ).toHaveCount(1);
}

test.describe("Каталог: каскады и восстановление доступности", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  test(
    "два занятых слота скрывают участника, отмена одного возвращает его",
    async ({ appFactory }) => {
      const runId = makeRunId("two-slots-recovery");
      const skill = `TwoSlotsRecovery-${runId}`;
      const host = makeUser("two-slots-recovery-host", runId);
      const bookerA = makeUser("booker-a", runId);
      const bookerB = makeUser("booker-b", runId);

      const hostApp = await appFactory();
      const bookerAApp = await appFactory();
      const bookerBApp = await appFactory();
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
        bookerAApp.context.request,
        bookerA,
      );

      await registerUserViaApi(
        bookerBApp.context.request,
        bookerB,
      );

      await test.step(
        "Первый пользователь: бронирует слот 12:00",
        async () => {
          const status = await bookParticipant(
            bookerAApp,
            host.name,
            skill,
            "12:00",
          );

          expect(status).toBe("success");
        },
      );

      await test.step(
        "После первой брони хост остаётся доступен из-за второго слота",
        async () => {
          await waitForCatalogPresence(
            observerApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Второй пользователь: бронирует слот 13:00",
        async () => {
          const status = await bookParticipant(
            bookerBApp,
            host.name,
            skill,
            "13:00",
          );

          expect(status).toBe("success");
        },
      );

      await test.step(
        "После занятия обоих слотов хост исчезает из каталога",
        async () => {
          await waitForCatalogAbsence(
            observerApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Первый пользователь: отменяет свою встречу",
        async () => {
          await bookerAApp.bookingPage.goToBookings();

          await expect(
            bookerAApp.bookingPage.upcomingBookingByParticipant(
              host.name,
            ),
          ).toBeVisible({ timeout: 10_000 });

          await bookerAApp.bookingPage.cancelBookingWith(
            host.name,
          );
        },
      );

      await test.step(
        "После освобождения одного слота хост снова доступен",
        async () => {
          await waitForCatalogPresence(
            observerApp,
            host.name,
            skill,
          );
        },
      );
    },
  );

  test(
    "удаление хоста каскадом убирает активную встречу у гостя",
    async ({ appFactory }) => {
      const runId = makeRunId("delete-host-cascade");
      const skill = `DeleteHost-${runId}`;
      const host = makeUser("delete-host", runId);
      const booker = makeUser("delete-host-booker", runId);

      const hostApp = await appFactory();
      const bookerApp = await appFactory();

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
        "Гость: бронирует встречу с хостом",
        async () => {
          const status = await bookParticipant(
            bookerApp,
            host.name,
            skill,
          );

          expect(status).toBe("success");
        },
      );

      await test.step(
        "Контроль: активная встреча отображается у гостя",
        async () => {
          await bookerApp.bookingPage.goToBookings();

          await expect(
            bookerApp.bookingPage.upcomingBookingByParticipant(
              host.name,
            ),
          ).toBeVisible({ timeout: 10_000 });
        },
      );

      await test.step(
        "Хост: удаляет свой тестовый аккаунт через API",
        async () => {
          await deleteUserViaApi(
            hostApp.context.request,
          );
        },
      );

      await test.step(
        "Cascade cleanup удаляет активную встречу у гостя",
        async () => {
          await expect
            .poll(
              async () => {
                await bookerApp.bookingPage.goToBookings();

                return bookerApp.bookingPage
                  .upcomingBookingByParticipant(host.name)
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
    },
  );
});
