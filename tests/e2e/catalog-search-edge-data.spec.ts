import { expect, test } from "../fixtures/app-fixtures";
import type { AppContext } from "../helpers/booking";
import { prepareCatalogParticipant } from "../helpers/catalog";
import { makeRunId } from "../helpers/test-data";
import { makeUser } from "../helpers/user";

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

test.describe("Каталог: дополнительные граничные данные", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  const specialSkillPrefixes = [
    "C#",
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
