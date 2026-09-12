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
  type TestUser,
} from "../helpers/user";

const TEST_TIMEOUT = 180_000;
const CATALOG_RESULT_TIMEOUT = 30_000;

async function prepareParticipantWithSkills(
  app: AppContext,
  user: TestUser,
  skills: readonly string[],
  time = "12:00",
): Promise<void> {
  await test.step(
    `${user.name}: создаёт аккаунт через API и добавляет несколько навыков`,
    async () => {
      await registerUserViaApi(app.context.request, user);
      await app.profilePage.goto();

      for (const skill of skills) {
        await app.profilePage.addSkill(skill, "can_help");
      }
    },
  );

  await addFutureSlot(app, user.name, time);
}

async function findParticipant(
  app: AppContext,
  name: string,
  skill: string,
): Promise<void> {
  await app.bookingPage.goToCatalog();
  await app.bookingPage.searchCatalog(skill);
  await app.bookingPage.waitForPersonInCatalog(
    name,
    skill,
    CATALOG_RESULT_TIMEOUT,
  );
}

async function expectParticipantAbsentEventually(
  app: AppContext,
  name: string,
  skill: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await app.bookingPage.goToCatalog();
        await app.bookingPage.searchCatalog(skill);

        return app.bookingPage.personCard(name).count();
      },
      {
        timeout: CATALOG_RESULT_TIMEOUT,
        intervals: [500, 1_000, 2_000],
        message:
          `Участник ${name} должен исчезнуть из каталога ` +
          `по навыку ${skill}`,
      },
    )
    .toBe(0);
}

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
    await bookerApp.bookingPage.pickAvailableSlotByTime(slotTime);
  } else {
    await bookerApp.bookingPage.pickOnlyAvailableSlot();
  }

  await bookerApp.bookingPage.confirmBooking();

  const result = await bookerApp.bookingPage.waitForBookingResult();

  return result.status;
}

test.describe("Каталог: расширенные правила поиска", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  test(
    "участник с двумя навыками находится по каждому из них",
    async ({ appFactory }) => {
      const runId = makeRunId("multi-skill");
      const skillA = `Playwright-${runId}`;
      const skillB = `TypeScript-${runId}`;
      const host = makeUser("multi-skill-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareParticipantWithSkills(
        hostApp,
        host,
        [skillA, skillB],
      );

      await test.step(
        "Гость: ищет участника по первому навыку",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skillA,
          );
        },
      );

      await test.step(
        "По первому навыку видна ровно одна карточка участника",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );

      await test.step(
        "Гость: ищет того же участника по второму навыку",
        async () => {
          await guestApp.bookingPage.searchCatalog(skillB);
          await guestApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skillB,
            CATALOG_RESULT_TIMEOUT,
          );
        },
      );

      await test.step(
        "По второму навыку видна та же единственная карточка",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "два свободных слота не дублируют карточку участника",
    async ({ appFactory }) => {
      const runId = makeRunId("multi-slot");
      const skill = `MultiSlot-${runId}`;
      const host = makeUser("multi-slot-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

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

      await test.step(
        "Гость: ищет участника с двумя свободными слотами",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "В каталоге нет дублей одной и той же карточки",
        async () => {
          const hostCard =
            guestApp.bookingPage.personCard(host.name);

          await expect(hostCard).toBeVisible();
          await expect(hostCard).toHaveCount(1);
        },
      );
    },
  );

  test(
    "пользователь с общим навыком видит другого участника, но не себя",
    async ({ appFactory }) => {
      const runId = makeRunId("shared-self-filter");
      const skill = `SharedSelf-${runId}`;
      const currentUser = makeUser("current", runId);
      const peer = makeUser("peer", runId);

      const currentApp = await appFactory();
      const peerApp = await appFactory();

      await prepareCatalogParticipant(
        currentApp,
        currentUser,
        skill,
        "12:00",
      );

      await prepareCatalogParticipant(
        peerApp,
        peer,
        skill,
        "13:00",
      );

      await test.step(
        "Авторизованный пользователь: ищет общий навык",
        async () => {
          await currentApp.bookingPage.goToCatalog();
          await currentApp.bookingPage.searchCatalog(skill);
          await currentApp.bookingPage.waitForPersonInCatalog(
            peer.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );
        },
      );

      await test.step(
        "В выдаче есть другой участник и нет собственной карточки",
        async () => {
          await expect(
            currentApp.bookingPage.personCard(peer.name),
          ).toHaveCount(1);

          await expect(
            currentApp.bookingPage.personCard(currentUser.name),
          ).toHaveCount(0);
        },
      );
    },
  );

  test(
    "после удаления навыка участник исчезает из поиска",
    async ({ appFactory }) => {
      const runId = makeRunId("remove-skill");
      const skill = `RemoveSkill-${runId}`;
      const host = makeUser("remove-skill-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Контроль: до удаления навык приводит к карточке участника",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Хост: удаляет навык из профиля",
        async () => {
          await hostApp.profilePage.goto();
          await hostApp.profilePage.removeSkill(skill);
        },
      );

      await test.step(
        "После удаления навыка карточка исчезает из выдачи",
        async () => {
          await expectParticipantAbsentEventually(
            guestApp,
            host.name,
            skill,
          );
        },
      );
    },
  );

  test(
    "после замены навыка старый поиск пуст, новый находит участника",
    async ({ appFactory }) => {
      const runId = makeRunId("replace-skill");
      const oldSkill = `OldSkill-${runId}`;
      const newSkill = `NewSkill-${runId}`;
      const host = makeUser("replace-skill-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        oldSkill,
      );

      await test.step(
        "Контроль: исходный навык находится",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            oldSkill,
          );
        },
      );

      await test.step(
        "Хост: удаляет старый навык и добавляет новый",
        async () => {
          await hostApp.profilePage.goto();
          await hostApp.profilePage.removeSkill(oldSkill);
          await hostApp.profilePage.addSkill(
            newSkill,
            "can_help",
          );
        },
      );

      await test.step(
        "По старому навыку участник больше не находится",
        async () => {
          await expectParticipantAbsentEventually(
            guestApp,
            host.name,
            oldSkill,
          );
        },
      );

      await test.step(
        "По новому навыку участник находится",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            newSkill,
          );

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "навык хочу изучить не участвует в выдаче могу помочь",
    async ({ appFactory }) => {
      const runId = makeRunId("skill-type");
      const canHelpSkill = `CanHelp-${runId}`;
      const wantToLearnSkill = `WantToLearn-${runId}`;
      const host = makeUser("skill-type-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await test.step(
        "Хост: создаёт аккаунт и добавляет навыки разных типов",
        async () => {
          await registerUserViaApi(
            hostApp.context.request,
            host,
          );

          await hostApp.profilePage.goto();
          await hostApp.profilePage.addSkill(
            canHelpSkill,
            "can_help",
          );
          await hostApp.profilePage.addSkill(
            wantToLearnSkill,
            "want_to_learn",
          );
        },
      );

      await addFutureSlot(
        hostApp,
        host.name,
      );

      await test.step(
        "Контроль: по навыку могу помочь участник находится",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            canHelpSkill,
          );
        },
      );

      await test.step(
        "По навыку хочу изучить карточка участника не появляется",
        async () => {
          await expectParticipantAbsentEventually(
            guestApp,
            host.name,
            wantToLearnSkill,
          );
        },
      );
    },
  );

  test(
    "кириллический навык находится точным запросом",
    async ({ appFactory }) => {
      const runId = makeRunId("cyrillic-skill");
      const skill = `Тестирование-${runId}`;
      const host = makeUser("cyrillic-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Гость: ищет сохранённый кириллический навык",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Карточка участника найдена ровно один раз",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "после удаления аккаунта участник исчезает из каталога",
    async ({ appFactory }) => {
      const runId = makeRunId("delete-account");
      const skill = `DeleteAccount-${runId}`;
      const host = makeUser("delete-account-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Контроль: до удаления аккаунт присутствует в каталоге",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Хост: удаляет тестовый аккаунт через API",
        async () => {
          await deleteUserViaApi(
            hostApp.context.request,
          );
        },
      );

      await test.step(
        "После удаления аккаунта карточка исчезает",
        async () => {
          await expectParticipantAbsentEventually(
            guestApp,
            host.name,
            skill,
          );
        },
      );
    },
  );

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
          await expectParticipantAbsentEventually(
            observerApp,
            host.name,
            skill,
          );
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
          await findParticipant(
            observerApp,
            host.name,
            skill,
          );

          await expect(
            observerApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "добавление будущего слота делает участника доступным в каталоге",
    async ({ appFactory }) => {
      const runId = makeRunId("slot-transition");
      const skill = `SlotTransition-${runId}`;
      const host = makeUser("slot-transition-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await test.step(
        "Хост: создаёт аккаунт и навык без свободного слота",
        async () => {
          await registerUserViaApi(
            hostApp.context.request,
            host,
          );
          await hostApp.profilePage.goto();
          await hostApp.profilePage.addSkill(
            skill,
            "can_help",
          );
        },
      );

      await test.step(
        "До появления слота участник отсутствует в каталоге",
        async () => {
          await expectParticipantAbsentEventually(
            guestApp,
            host.name,
            skill,
          );
        },
      );

      await addFutureSlot(
        hostApp,
        host.name,
      );

      await test.step(
        "После добавления слота участник появляется в каталоге",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skill,
          );

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "удаление навыка у одного из двух участников не скрывает второго",
    async ({ appFactory }) => {
      const runId = makeRunId("shared-removal");
      const skill = `SharedRemoval-${runId}`;
      const hostA = makeUser("shared-a", runId);
      const hostB = makeUser("shared-b", runId);

      const hostAApp = await appFactory();
      const hostBApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostAApp,
        hostA,
        skill,
        "12:00",
      );

      await prepareCatalogParticipant(
        hostBApp,
        hostB,
        skill,
        "13:00",
      );

      await test.step(
        "Контроль: до изменения в каталоге видны оба участника",
        async () => {
          await findParticipant(
            guestApp,
            hostA.name,
            skill,
          );

          await expect(
            guestApp.bookingPage.personCard(hostB.name),
          ).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });
        },
      );

      await test.step(
        "Первый участник: удаляет общий навык",
        async () => {
          await hostAApp.profilePage.goto();
          await hostAApp.profilePage.removeSkill(skill);
        },
      );

      await test.step(
        "После изменения исчезает только первый участник",
        async () => {
          await expect
            .poll(
              async () => {
                await guestApp.bookingPage.goToCatalog();
                await guestApp.bookingPage.searchCatalog(skill);

                return {
                  hostA: await guestApp.bookingPage
                    .personCard(hostA.name)
                    .count(),
                  hostB: await guestApp.bookingPage
                    .personCard(hostB.name)
                    .count(),
                };
              },
              {
                timeout: CATALOG_RESULT_TIMEOUT,
                intervals: [500, 1_000, 2_000],
              },
            )
            .toEqual({ hostA: 0, hostB: 1 });
        },
      );
    },
  );

  test(
    "удаление одного из двух навыков сохраняет поиск по оставшемуся",
    async ({ appFactory }) => {
      const runId = makeRunId("partial-skill-removal");
      const skillA = `PartialA-${runId}`;
      const skillB = `PartialB-${runId}`;
      const host = makeUser("partial-removal-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareParticipantWithSkills(
        hostApp,
        host,
        [skillA, skillB],
      );

      await test.step(
        "Контроль: участник находится по обоим навыкам",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skillA,
          );

          await guestApp.bookingPage.searchCatalog(skillB);
          await guestApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skillB,
            CATALOG_RESULT_TIMEOUT,
          );
        },
      );

      await test.step(
        "Хост: удаляет только первый навык",
        async () => {
          await hostApp.profilePage.goto();
          await hostApp.profilePage.removeSkill(skillA);
        },
      );

      await test.step(
        "По удалённому навыку участник исчезает",
        async () => {
          await expectParticipantAbsentEventually(
            guestApp,
            host.name,
            skillA,
          );
        },
      );

      await test.step(
        "По оставшемуся навыку участник по-прежнему находится",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skillB,
          );

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );
});
