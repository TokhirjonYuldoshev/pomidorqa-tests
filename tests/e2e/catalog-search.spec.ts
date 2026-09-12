import { expect, test } from "../fixtures/app-fixtures";
import {
  addFutureSlot,
  prepareCatalogParticipant,
  registerWithSkill,
} from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import {
  deleteUserViaApi,
  makeUser,
  registerUser,
  registerUserViaApi,
} from "../helpers/user";

const TEST_TIMEOUT = 120_000;
const CATALOG_RESULT_TIMEOUT = 30_000;

test.describe("Поиск участников PomidorQA", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  test(
    "гость находит участника по уникальному навыку",
    async ({ appFactory }) => {
      test.setTimeout(90_000);

      const runId = makeRunId("guest-search");
      const skill = `SearchQA-${runId}`;
      const host = makeUser("host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      let hostRegistered = false;

      try {
        await test.step(
          "Хост: создаёт тестовый аккаунт через API",
          async () => {
            await registerUserViaApi(
              hostApp.context.request,
              host,
            );

            hostRegistered = true;
          },
        );

        await test.step(
          "Хост: добавляет уникальный навык",
          async () => {
            await hostApp.profilePage.goto();
            await hostApp.profilePage.addSkill(
              skill,
              "can_help",
            );
          },
        );

        await addFutureSlot(
          hostApp,
          host.name,
        );

        await test.step(
          "Гость: открывает каталог и ищет уникальный навык",
          async () => {
            await guestApp.bookingPage.goToCatalog();
            await guestApp.bookingPage.searchCatalog(skill);

            await guestApp.bookingPage.waitForPersonInCatalog(
              host.name,
              skill,
              CATALOG_RESULT_TIMEOUT,
            );
          },
        );

        await test.step(
          "В выдаче видна карточка подготовленного участника",
          async () => {
            const hostCard =
              guestApp.bookingPage.personCard(host.name);

            await expect(hostCard).toBeVisible();
            await expect(hostCard).toHaveCount(1);
          },
        );
      } finally {
        if (hostRegistered) {
          await test.step(
            "Cleanup: удаляет тестовый аккаунт через API",
            async () => {
              await deleteUserViaApi(
                hostApp.context.request,
              );
            },
          );
        }
      }
    },
  );

  test(
    "несуществующий навык возвращает пустую выдачу",
    async ({ appFactory }) => {
      const runId = makeRunId("empty-search");
      const existingSkill = `Existing-${runId}`;
      const missingSkill = `Missing-${runId}`;
      const host = makeUser("host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        existingSkill,
      );

      await test.step(
        "Гость: сначала ищет существующий уникальный навык",
        async () => {
          await guestApp.bookingPage.goToCatalog();
          await guestApp.bookingPage.searchCatalog(
            existingSkill,
          );
        },
      );

      await test.step(
        "Контроль: подготовленный участник доступен в каталоге",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });
        },
      );

      await test.step(
        "Гость: ищет заведомо несуществующий навык",
        async () => {
          await guestApp.bookingPage.searchCatalog(
            missingSkill,
          );
        },
      );

      await test.step(
        "Выдача для несуществующего навыка пустая",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(0);

          await expect(
            guestApp.bookingPage.personCards,
          ).toHaveCount(0);
        },
      );
    },
  );

  test(
    "авторизованный пользователь не видит собственную карточку, а гость видит",
    async ({ appFactory }) => {
      const runId = makeRunId("self-hidden");
      const skill = `SelfHidden-${runId}`;
      const host = makeUser("host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Гость: ищет навык подготовленного участника",
        async () => {
          await guestApp.bookingPage.goToCatalog();
          await guestApp.bookingPage.searchCatalog(skill);
        },
      );

      await test.step(
        "Контроль: гость видит карточку участника",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });
        },
      );

      await test.step(
        "Авторизованный участник: ищет собственный уникальный навык",
        async () => {
          await hostApp.bookingPage.goToCatalog();
          await hostApp.bookingPage.searchCatalog(skill);
        },
      );

      await test.step(
        "Авторизованный участник не видит собственную карточку",
        async () => {
          await expect(
            hostApp.bookingPage.personCard(host.name),
          ).toHaveCount(0);

          await expect(
            hostApp.bookingPage.personCards,
          ).toHaveCount(0);
        },
      );
    },
  );

  test(
    "гость видит двух участников с одинаковым навыком",
    async ({ appFactory }) => {
      const runId = makeRunId("shared-skill");
      const sharedSkill = `SharedSkill-${runId}`;
      const hostOne = makeUser("host-one", runId);
      const hostTwo = makeUser("host-two", runId);

      const hostOneApp = await appFactory();
      const hostTwoApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostOneApp,
        hostOne,
        sharedSkill,
        "12:00",
      );

      await prepareCatalogParticipant(
        hostTwoApp,
        hostTwo,
        sharedSkill,
        "13:00",
      );

      await test.step(
        "Гость: ищет общий навык двух участников",
        async () => {
          await guestApp.bookingPage.goToCatalog();
          await guestApp.bookingPage.searchCatalog(
            sharedSkill,
          );
        },
      );

      await test.step(
        "В выдаче видны обе конкретные карточки",
        async () => {
          const hostOneCard =
            guestApp.bookingPage.personCard(hostOne.name);

          const hostTwoCard =
            guestApp.bookingPage.personCard(hostTwo.name);

          await expect(hostOneCard).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });

          await expect(hostTwoCard).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });

          await expect(hostOneCard).toHaveCount(1);
          await expect(hostTwoCard).toHaveCount(1);
        },
      );
    },
  );

  test(
    "поиск оставляет подходящего участника и исключает неподходящего",
    async ({ appFactory }) => {
      const runId = makeRunId("filter");
      const matchingSkill = `Matching-${runId}`;
      const otherSkill = `Other-${runId}`;

      const matchingHost = makeUser(
        "matching-host",
        runId,
      );

      const otherHost = makeUser(
        "other-host",
        runId,
      );

      const matchingHostApp = await appFactory();
      const otherHostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        matchingHostApp,
        matchingHost,
        matchingSkill,
        "12:00",
      );

      await prepareCatalogParticipant(
        otherHostApp,
        otherHost,
        otherSkill,
        "13:00",
      );

      await test.step(
        "Гость: ищет подходящего участника",
        async () => {
          await guestApp.bookingPage.goToCatalog();
          await guestApp.bookingPage.searchCatalog(
            matchingSkill,
          );
        },
      );

      await test.step(
        "Контроль: подходящий участник доступен",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(
              matchingHost.name,
            ),
          ).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });
        },
      );

      await test.step(
        "Гость: ищет второго участника по его навыку",
        async () => {
          await guestApp.bookingPage.searchCatalog(
            otherSkill,
          );
        },
      );

      await test.step(
        "Контроль: второй участник также доступен",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(
              otherHost.name,
            ),
          ).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });
        },
      );

      await test.step(
        "Гость: выполняет итоговый поиск по первому навыку",
        async () => {
          await guestApp.bookingPage.searchCatalog(
            matchingSkill,
          );
        },
      );

      await test.step(
        "Подходящий участник остаётся, неподходящий отсутствует",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(
              matchingHost.name,
            ),
          ).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });

          await expect(
            guestApp.bookingPage.personCard(
              otherHost.name,
            ),
          ).toHaveCount(0);
        },
      );
    },
  );

  test(
    "участник без будущего свободного слота не попадает в каталог",
    async ({ appFactory }) => {
      const runId = makeRunId("slot-rule");
      const sharedSkill = `SlotRule-${runId}`;

      const eligibleHost = makeUser(
        "with-slot",
        runId,
      );

      const noSlotHost = makeUser(
        "without-slot",
        runId,
      );

      const eligibleHostApp = await appFactory();
      const noSlotHostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        eligibleHostApp,
        eligibleHost,
        sharedSkill,
      );

      await registerWithSkill(
        noSlotHostApp,
        noSlotHost,
        sharedSkill,
      );

      await test.step(
        "Контроль: навык участника без слота сохранён в профиле",
        async () => {
          await expect(
            noSlotHostApp.profilePage.canHelpSkillItem(
              sharedSkill,
            ),
          ).toBeVisible();
        },
      );

      await test.step(
        "Гость: ищет общий навык двух участников",
        async () => {
          await guestApp.bookingPage.goToCatalog();
          await guestApp.bookingPage.searchCatalog(
            sharedSkill,
          );
        },
      );

      await test.step(
        "Участник со слотом виден, участник без слота отсутствует",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(
              eligibleHost.name,
            ),
          ).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });

          await expect(
            guestApp.bookingPage.personCard(
              noSlotHost.name,
            ),
          ).toHaveCount(0);
        },
      );
    },
  );

  test(
    "повторный поиск новым навыком обновляет выдачу",
    async ({ appFactory }) => {
      const runId = makeRunId("repeat-search");
      const skillA = `RepeatA-${runId}`;
      const skillB = `RepeatB-${runId}`;
      const hostA = makeUser("host-a", runId);
      const hostB = makeUser("host-b", runId);

      const hostAApp = await appFactory();
      const hostBApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostAApp,
        hostA,
        skillA,
        "12:00",
      );

      await prepareCatalogParticipant(
        hostBApp,
        hostB,
        skillB,
        "13:00",
      );

      await test.step(
        "Гость: открывает каталог и ищет первый навык",
        async () => {
          await guestApp.bookingPage.goToCatalog();
          await guestApp.bookingPage.searchCatalog(
            skillA,
          );
        },
      );

      await test.step(
        "После первого поиска виден только первый участник",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(hostA.name),
          ).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });

          await expect(
            guestApp.bookingPage.personCard(hostB.name),
          ).toHaveCount(0);
        },
      );

      await test.step(
        "Гость: без перезагрузки ищет второй навык",
        async () => {
          await guestApp.bookingPage.searchCatalog(
            skillB,
          );
        },
      );

      await test.step(
        "После второго поиска выдача соответствует новому навыку",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(hostB.name),
          ).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });

          await expect(
            guestApp.bookingPage.personCard(hostA.name),
          ).toHaveCount(0);
        },
      );
    },
  );

  test(
    "авторизованный пользователь находит другого участника по уникальному навыку",
    async ({ appFactory }) => {
      const runId = makeRunId("authorized-search");
      const skill = `Authorized-${runId}`;
      const host = makeUser("host", runId);

      const searcher = makeUser(
        "searcher",
        runId,
      );

      const hostApp = await appFactory();
      const searcherApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Второй пользователь: регистрируется",
        async () => {
          await registerUser(
            searcherApp.page,
            searcher,
          );
        },
      );

      await test.step(
        "Авторизованный пользователь: ищет навык другого участника",
        async () => {
          await searcherApp.bookingPage.goToCatalog();

          await searcherApp.bookingPage.searchCatalog(
            skill,
          );
        },
      );

      await test.step(
        "Авторизованный пользователь видит карточку другого участника",
        async () => {
          const hostCard =
            searcherApp.bookingPage.personCard(host.name);

          await expect(hostCard).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });

          await expect(hostCard).toHaveCount(1);
        },
      );
    },
  );
});
