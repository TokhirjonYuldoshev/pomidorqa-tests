import { expect, test } from "../fixtures/app-fixtures";
import type { AppContext } from "../helpers/booking";
import {
  addFutureSlot,
  prepareCatalogParticipant,
  prepareCatalogParticipantWithSkills,
} from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import {
  deleteUserViaApi,
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

const TEST_TIMEOUT = 180_000;
const CATALOG_RESULT_TIMEOUT = 30_000;

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

async function catalogCount(
  app: AppContext,
  name: string,
  skill: string,
): Promise<number> {
  await app.bookingPage.goToCatalog();
  await app.bookingPage.searchCatalog(skill);

  return app.bookingPage.personCard(name).count();
}

test.describe("Каталог: изменения состояния", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

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
        "Контроль: до удаления участник находится",
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
          await expect
            .poll(
              () => catalogCount(
                guestApp,
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

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
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
          await expect
            .poll(
              () => catalogCount(
                guestApp,
                host.name,
                oldSkill,
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

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
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
          await expect
            .poll(
              () => catalogCount(
                guestApp,
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
    "добавление будущего слота делает участника доступным в каталоге",
    async ({ appFactory }) => {
      const runId = makeRunId("slot-transition");
      const skill = `SlotTransition-${runId}`;
      const target = makeUser("slot-target", runId);
      const control = makeUser("slot-control", runId);

      const targetApp = await appFactory();
      const controlApp = await appFactory();
      const guestApp = await appFactory();

      await test.step(
        "Целевой участник: создаёт аккаунт и навык без слота",
        async () => {
          await registerUserViaApi(
            targetApp.context.request,
            target,
          );
          await targetApp.profilePage.goto();
          await targetApp.profilePage.addSkill(
            skill,
            "can_help",
          );
        },
      );

      await prepareCatalogParticipant(
        controlApp,
        control,
        skill,
        "13:00",
      );

      await test.step(
        "Контроль: каталог загружен, но участник без слота отсутствует",
        async () => {
          await findParticipant(
            guestApp,
            control.name,
            skill,
          );

          await expect(
            guestApp.bookingPage.personCard(control.name),
          ).toHaveCount(1);

          await expect(
            guestApp.bookingPage.personCard(target.name),
          ).toHaveCount(0);
        },
      );

      await addFutureSlot(
        targetApp,
        target.name,
      );

      await test.step(
        "После добавления слота участник появляется в каталоге",
        async () => {
          await findParticipant(
            guestApp,
            target.name,
            skill,
          );

          await expect(
            guestApp.bookingPage.personCard(target.name),
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

          await guestApp.bookingPage.waitForPersonInCatalog(
            hostB.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );

          await expect(
            guestApp.bookingPage.personCard(hostA.name),
          ).toHaveCount(1);

          await expect(
            guestApp.bookingPage.personCard(hostB.name),
          ).toHaveCount(1);
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

      await prepareCatalogParticipantWithSkills(
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

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);

          await guestApp.bookingPage.searchCatalog(skillB);
          await guestApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skillB,
            CATALOG_RESULT_TIMEOUT,
          );

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
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
          await expect
            .poll(
              () => catalogCount(
                guestApp,
                host.name,
                skillA,
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
