import { expect, test } from "../fixtures/app-fixtures";
import type { AppContext } from "../helpers/booking";
import {
  addFutureSlot,
  prepareCatalogParticipant,
  prepareCatalogParticipantWithSkills,
} from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

const TEST_TIMEOUT = 150_000;
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

test.describe("Каталог: данные и фильтрация", () => {
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

      await prepareCatalogParticipantWithSkills(
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
        "По первому навыку видна одна карточка участника",
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
    "участник находится по навыкам обоих типов",
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
        "По навыку могу помочь участник находится",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            canHelpSkill,
          );

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );

      await test.step(
        "По навыку хочу изучить участник также находится",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            wantToLearnSkill,
          );

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
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
});
