import { expect, test } from "../fixtures/app-fixtures";
import type { AppContext } from "../helpers/booking";
import {
  prepareCatalogParticipant,
} from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import { makeUser } from "../helpers/user";

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

async function catalogSnapshot(
  app: AppContext,
  oldName: string,
  newName: string,
  skill: string,
): Promise<{ oldName: number; newName: number }> {
  await app.bookingPage.goToCatalog();
  await app.bookingPage.searchCatalog(skill);

  return {
    oldName: await app.bookingPage.personCard(oldName).count(),
    newName: await app.bookingPage.personCard(newName).count(),
  };
}

test.describe("Каталог: граничные данные поиска", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  test(
    "навык с пробелами внутри находится точным запросом",
    async ({ appFactory }) => {
      const runId = makeRunId("space-skill");
      const skill = `API Testing ${runId}`;
      const host = makeUser("space-skill-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Гость: ищет навык с пробелами точным текстом",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Участник найден ровно один раз",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(1);
        },
      );
    },
  );

  const specialSkillPrefixes = [
    "C#",
    "C++",
    ".NET",
    "QA/API",
    "SQL_100%",
    "QA's",
  ] as const;

  for (const prefix of specialSkillPrefixes) {
    test(
      `навык со спецсимволами ${prefix} находится точным запросом`,
      async ({ appFactory }) => {
        const runId = makeRunId("special-skill");
        const skill = `${prefix}-${runId}`;
        const host = makeUser("special-skill-host", runId);

        const hostApp = await appFactory();
        const guestApp = await appFactory();

        await prepareCatalogParticipant(
          hostApp,
          host,
          skill,
        );

        await test.step(
          `Гость: ищет точный навык ${prefix}`,
          async () => {
            await findParticipant(
              guestApp,
              host.name,
              skill,
            );
          },
        );

        await test.step(
          "Карточка участника не теряется и не дублируется",
          async () => {
            await expect(
              guestApp.bookingPage.personCard(host.name),
            ).toHaveCount(1);
          },
        );
      },
    );
  }

  test(
    "поиск по имени участника не подменяет фильтр по навыку",
    async ({ appFactory }) => {
      const runId = makeRunId("skill-only-filter");
      const skill = `SkillOnly-${runId}`;
      const host = makeUser("skill-only-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Контроль: точный навык находит участника",
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
        "Гость: вводит имя участника в поле Навык",
        async () => {
          await guestApp.bookingPage.searchCatalog(
            host.name,
          );
        },
      );

      await test.step(
        "По имени карточка не попадает в skill-filter выдачу",
        async () => {
          await expect(
            guestApp.bookingPage.personCard(host.name),
          ).toHaveCount(0);
        },
      );
    },
  );

  test(
    "пустой фильтр после точного поиска возвращает доступного участника",
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
        "Контроль: фильтр по навыку находит участника",
        async () => {
          await findParticipant(
            guestApp,
            host.name,
            skill,
          );
        },
      );

      await test.step(
        "Гость: очищает фильтр и запускает поиск",
        async () => {
          await guestApp.bookingPage.searchCatalog("");
        },
      );

      await test.step(
        "Доступный участник остаётся в нефильтрованном каталоге",
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
    "изменение имени участника отражается в каталоге",
    async ({ appFactory }) => {
      const runId = makeRunId("rename-catalog");
      const skill = `Rename-${runId}`;
      const host = makeUser("rename-host", runId);
      const oldName = host.name;
      const newName = `renamed Автотест ${runId}`;

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await prepareCatalogParticipant(
        hostApp,
        host,
        skill,
      );

      await test.step(
        "Контроль: до изменения видно старое имя",
        async () => {
          await findParticipant(
            guestApp,
            oldName,
            skill,
          );

          await expect(
            guestApp.bookingPage.personCard(oldName),
          ).toHaveCount(1);
        },
      );

      await test.step(
        "Хост: сохраняет новое имя",
        async () => {
          await hostApp.profilePage.goto();
          await hostApp.profilePage.saveName(newName);
        },
      );

      await test.step(
        "Каталог показывает новое имя и больше не показывает старое",
        async () => {
          await expect
            .poll(
              () => catalogSnapshot(
                guestApp,
                oldName,
                newName,
                skill,
              ),
              {
                timeout: CATALOG_RESULT_TIMEOUT,
                intervals: [500, 1_000, 2_000],
              },
            )
            .toEqual({ oldName: 0, newName: 1 });
        },
      );
    },
  );
});
