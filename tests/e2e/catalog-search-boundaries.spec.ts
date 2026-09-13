import { expect, test } from "../fixtures/app-fixtures";
import type { AppContext } from "../helpers/booking";
import {
  addFutureSlot,
  prepareCatalogParticipant,
  registerWithSkill,
} from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import {
  deleteUserViaApi,
  makeUser,
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

test.describe("Каталог: граничные сценарии поиска", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  test(
    "участники с одинаковым тегом разных типов навыка видны вместе",
    async ({ appFactory }) => {
      const runId = makeRunId("mixed-skill-types");
      const skill = `MixedType-${runId}`;
      const helper = makeUser("can-help", runId);
      const learner = makeUser("want-to-learn", runId);

      const helperApp = await appFactory();
      const learnerApp = await appFactory();
      const guestApp = await appFactory();

      await registerWithSkill(
        helperApp,
        helper,
        skill,
        "can_help",
      );
      await addFutureSlot(helperApp, helper.name, "12:00");

      await registerWithSkill(
        learnerApp,
        learner,
        skill,
        "want_to_learn",
      );
      await addFutureSlot(learnerApp, learner.name, "13:00");

      await test.step(
        "Гость: ищет общий тег навыка",
        async () => {
          await findParticipant(
            guestApp,
            helper.name,
            skill,
          );

          await guestApp.bookingPage.waitForPersonInCatalog(
            learner.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );
        },
      );

      await test.step(
        "В выдаче есть оба участника независимо от типа навыка",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(helper.name),
          ).toHaveCount(1);

          await expect(
            guestApp.bookingPage.personCard(learner.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "одинаковые имена участников не смешивают выдачу разных навыков",
    async ({ appFactory }) => {
      const runId = makeRunId("same-display-name");
      const skillA = `SameNameA-${runId}`;
      const skillB = `SameNameB-${runId}`;
      const sharedName = `Тёзка Автотест ${runId}`;

      const hostA = {
        ...makeUser("same-name-a", runId),
        name: sharedName,
      };

      const hostB = {
        ...makeUser("same-name-b", runId),
        name: sharedName,
      };

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
        "Гость: ищет первый уникальный навык",
        async () => {
          await findParticipant(
            guestApp,
            sharedName,
            skillA,
          );
        },
      );

      await test.step(
        "Первый навык возвращает ровно одну карточку",
        async () => {
          await expect(
            guestApp.bookingPage.personCards,
          ).toHaveCount(1);

          await expect(
            guestApp.bookingPage.personCard(sharedName),
          ).toHaveCount(1);
        },
      );

      await test.step(
        "Гость: ищет второй уникальный навык",
        async () => {
          await guestApp.bookingPage.searchCatalog(skillB);
          await guestApp.bookingPage.waitForPersonInCatalog(
            sharedName,
            skillB,
            CATALOG_RESULT_TIMEOUT,
          );
        },
      );

      await test.step(
        "Второй навык также возвращает ровно одну карточку",
        async () => {
          await expect(
            guestApp.bookingPage.personCards,
          ).toHaveCount(1);

          await expect(
            guestApp.bookingPage.personCard(sharedName),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "многословный латинский навык находится точным запросом",
    async ({ appFactory }) => {
      const runId = makeRunId("multi-word-skill");
      const skill = `API Testing ${runId}`;
      const host = makeUser("multi-word-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Гость: ищет полный многословный навык",
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
    "навык со спецсимволами C++ находится точным запросом",
    async ({ appFactory }) => {
      const runId = makeRunId("special-char-skill");
      const skill = `C++-${runId}`;
      const host = makeUser("special-char-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Контроль: навык со спецсимволами сохранён в профиле",
        async () => {
          await hostApp.profilePage.goto();

          await expect(
            hostApp.profilePage.canHelpSkillItem(skill),
          ).toBeVisible();
        },
      );

      await test.step(
        "Гость: ищет полный навык со спецсимволами",
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
    "после пустой выдачи валидный поиск восстанавливает результат",
    async ({ appFactory }) => {
      const runId = makeRunId("recover-after-empty");
      const skill = `Recover-${runId}`;
      const missingSkill = `Missing-${runId}`;
      const host = makeUser("recover-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Гость: сначала получает пустую выдачу",
        async () => {
          await guestApp.bookingPage.goToCatalog();
          await guestApp.bookingPage.searchCatalog(
            missingSkill,
          );

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(0);
        },
      );

      await test.step(
        "Гость: затем ищет существующий навык",
        async () => {
          await guestApp.bookingPage.searchCatalog(skill);
          await guestApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );
        },
      );

      await test.step(
        "После пустого результата новый поиск работает корректно",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "повтор того же фильтра видит нового участника",
    async ({ appFactory }) => {
      const runId = makeRunId("same-filter-refresh");
      const skill = `SameFilter-${runId}`;
      const hostA = makeUser("same-filter-a", runId);
      const hostB = makeUser("same-filter-b", runId);

      const hostAApp = await appFactory();
      const hostBApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostAApp,
        hostA,
        skill,
        "12:00",
      );

      await test.step(
        "Контроль: первый участник уже находится",
        async () => {
          await findParticipant(
            guestApp,
            hostA.name,
            skill,
          );

          await expect(
            guestApp.bookingPage.personCard(hostA.name),
          ).toHaveCount(1);
        },
      );

      await prepareCatalogParticipant(
        hostBApp,
        hostB,
        skill,
        "13:00",
      );

      await test.step(
        "Гость: повторяет тот же поисковый запрос",
        async () => {
          await guestApp.bookingPage.searchCatalog(skill);
          await guestApp.bookingPage.waitForPersonInCatalog(
            hostB.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );
        },
      );

      await test.step(
        "Обновлённая выдача содержит обоих участников",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(hostA.name),
          ).toHaveCount(1);

          await expect(
            guestApp.bookingPage.personCard(hostB.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "добавление второго навыка сохраняет первый и открывает новый поиск",
    async ({ appFactory }) => {
      const runId = makeRunId("add-second-skill");
      const skillA = `ExistingSkill-${runId}`;
      const skillB = `AddedSkill-${runId}`;
      const host = makeUser("second-skill-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skillA,
      );

      await test.step(
        "Контроль: исходный навык уже находится",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skillA,
          );
        },
      );

      await test.step(
        "Хост: добавляет второй навык",
        async () => {
          await hostApp.profilePage.goto();
          await hostApp.profilePage.addSkill(
            skillB,
            "can_help",
          );
        },
      );

      await test.step(
        "По новому навыку участник появляется в поиске",
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

      await test.step(
        "Исходный навык остаётся доступным",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skillA,
          );

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "удаление одного из двух matching аккаунтов оставляет второго",
    async ({ appFactory }) => {
      const runId = makeRunId("delete-one-of-two");
      const skill = `DeleteOne-${runId}`;
      const hostA = makeUser("delete-a", runId);
      const hostB = makeUser("delete-b", runId);

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
        "Контроль: до удаления видны оба участника",
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
        },
      );

      await test.step(
        "Первый участник: удаляет аккаунт через API",
        async () => {
          await deleteUserViaApi(
            hostAApp.context.request,
          );
        },
      );

      await test.step(
        "Из выдачи исчезает только удалённый аккаунт",
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
    "повторное добавление удалённого навыка возвращает участника в каталог",
    async ({ appFactory }) => {
      const runId = makeRunId("remove-readd-skill");
      const skill = `ReAdd-${runId}`;
      const host = makeUser("readd-host", runId);

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
        },
      );

      await test.step(
        "Хост: удаляет навык",
        async () => {
          await hostApp.profilePage.goto();
          await hostApp.profilePage.removeSkill(skill);
        },
      );

      await test.step(
        "После удаления участник исчезает из поиска",
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

      await test.step(
        "Хост: повторно добавляет тот же навык",
        async () => {
          await hostApp.profilePage.goto();
          await hostApp.profilePage.addSkill(
            skill,
            "can_help",
          );
        },
      );

      await test.step(
        "После повторного добавления участник снова находится",
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
});
