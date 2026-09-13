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

async function searchAndWait(
  app: AppContext,
  participantName: string,
  query: string,
): Promise<void> {
  await app.bookingPage.goToCatalog();
  await app.bookingPage.searchCatalog(query);
  await app.bookingPage.waitForPersonInCatalog(
    participantName,
    query,
    CATALOG_RESULT_TIMEOUT,
  );
}

test.describe("Каталог: семантика поиска", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  test(
    "пробелы вокруг запроса не мешают найти точный навык",
    async ({ appFactory }) => {
      const runId = makeRunId("trim-search");
      const skill = `TrimSkill-${runId}`;
      const query = `  ${skill}  `;
      const host = makeUser("trim-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Гость: ищет навык с внешними пробелами",
        async () => {
          await searchAndWait(
            guestApp,
            host.name,
            query,
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
    "поиск навыка не зависит от регистра букв",
    async ({ appFactory }) => {
      const runId = makeRunId("case-search");
      const skill = `CaseSensitive-${runId}`;
      const query = skill.toLowerCase();
      const host = makeUser("case-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Гость: ищет сохранённый навык в другом регистре",
        async () => {
          await searchAndWait(
            guestApp,
            host.name,
            query,
          );
        },
      );

      await test.step(
        "Участник найден независимо от регистра запроса",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "частичный запрос находит навык по уникальному фрагменту",
    async ({ appFactory }) => {
      const runId = makeRunId("partial-search");
      const query = `Fragment-${runId}`;
      const skill = `${query}-Advanced`;
      const host = makeUser("partial-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Гость: ищет по уникальной части полного навыка",
        async () => {
          await searchAndWait(
            guestApp,
            host.name,
            query,
          );
        },
      );

      await test.step(
        "Частичное совпадение возвращает нужного участника",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "пустой запрос показывает подходящего участника каталога",
    async ({ appFactory }) => {
      const runId = makeRunId("empty-filter");
      const skill = `EmptyFilter-${runId}`;
      const host = makeUser("empty-filter-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Гость: отправляет пустой фильтр навыка",
        async () => {
          await searchAndWait(
            guestApp,
            host.name,
            "",
          );
        },
      );

      await test.step(
        "В нефильтрованном каталоге виден подготовленный участник",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "Enter отправляет поиск так же, как кнопка Найти",
    async ({ appFactory }) => {
      const runId = makeRunId("enter-search");
      const skill = `EnterSkill-${runId}`;
      const missingSkill = `Missing-${runId}`;
      const host = makeUser("enter-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Контроль: данные готовы и участник находится обычным поиском",
        async () => {
          await searchAndWait(
            guestApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Гость: меняет запрос на несуществующий",
        async () => {
          await guestApp.bookingPage.searchCatalog(
            missingSkill,
          );

          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(0);
        },
      );

      await test.step(
        "Гость: вводит исходный навык и нажимает Enter",
        async () => {
          await guestApp.bookingPage.searchCatalogByEnter(
            skill,
          );
        },
      );

      await test.step(
        "После Enter нужная карточка снова появилась",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toBeVisible({
            timeout: CATALOG_RESULT_TIMEOUT,
          });
        },
      );
    },
  );

  test(
    "имя участника не подменяет фильтр по навыку",
    async ({ appFactory }) => {
      const runId = makeRunId("name-is-not-skill");
      const skill = `OnlySkill-${runId}`;
      const host = makeUser("name-filter-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Контроль: участник находится по своему навыку",
        async () => {
          await searchAndWait(
            guestApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Гость: вводит имя участника в поле Навык",
        async () => {
          await guestApp.bookingPage.searchCatalog(
            host.name,
          );
        },
      );

      await test.step(
        "Поиск по имени не возвращает карточку как совпадение навыка",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(0);
        },
      );
    },
  );

  test(
    "навык со спецсимволами находится точным запросом",
    async ({ appFactory }) => {
      const runId = makeRunId("special-skill");
      const skill = `C++/.NET-${runId}`;
      const host = makeUser("special-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Гость: ищет сохранённый навык со спецсимволами",
        async () => {
          await searchAndWait(
            guestApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Карточка содержит найденный навык со спецсимволами",
        async () => {
          const hostCard =
            guestApp.bookingPage.personCard(host.name);

          await expect(hostCard).toHaveCount(1);
          await expect(hostCard).toContainText(skill);
        },
      );
    },
  );

  test(
    "добавление навыка делает участника с готовым слотом доступным в поиске",
    async ({ appFactory }) => {
      const runId = makeRunId("skill-transition");
      const skill = `SkillTransition-${runId}`;
      const target = makeUser("skill-target", runId);
      const control = makeUser("skill-control", runId);

      const targetApp = await appFactory();
      const controlApp = await appFactory();
      const guestApp = await appFactory();

      await test.step(
        "Целевой участник: создаёт аккаунт и слот без навыка",
        async () => {
          await registerUserViaApi(
            targetApp.context.request,
            target,
          );
          await addFutureSlot(
            targetApp,
            target.name,
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
        "Контроль: поиск загружен, участник без навыка отсутствует",
        async () => {
          await searchAndWait(
            guestApp,
            control.name,
            skill,
          );

          await expect(
            guestApp.bookingPage.personCard(target.name),
          ).toHaveCount(0);
        },
      );

      await test.step(
        "Целевой участник: добавляет искомый навык",
        async () => {
          await targetApp.profilePage.goto();
          await targetApp.profilePage.addSkill(
            skill,
            "can_help",
          );
        },
      );

      await test.step(
        "После добавления навыка участник появляется в поиске",
        async () => {
          await guestApp.bookingPage.waitForPersonInCatalog(
            target.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );

          await expect(
            guestApp.bookingPage.personCard(target.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "новый второй навык становится доступен без потери старого",
    async ({ appFactory }) => {
      const runId = makeRunId("add-second-skill");
      const skillA = `FirstSkill-${runId}`;
      const skillB = `SecondSkill-${runId}`;
      const host = makeUser("second-skill-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skillA,
      );

      await test.step(
        "Контроль: исходный навык находится",
        async () => {
          await searchAndWait(
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
          await searchAndWait(
            guestApp,
            host.name,
            skillB,
          );
        },
      );

      await test.step(
        "Исходный навык по-прежнему находит того же участника",
        async () => {
          await searchAndWait(
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
});
