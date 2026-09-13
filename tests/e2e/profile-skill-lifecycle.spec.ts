import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

test.describe("Профиль: жизненный цикл навыков", () => {
  test(
    "навык «могу помочь» сохраняется после перезагрузки профиля",
    async ({ appFactory }) => {
      const runId = makeRunId("can-help-persist");
      const user = makeUser("profile-user", runId);
      const skill = `PersistCanHelp-${runId}`;
      const app = await appFactory();

      await test.step(
        "Arrange: создаём аккаунт через API и открываем профиль",
        async () => {
          await registerUserViaApi(
            app.context.request,
            user,
          );
          await app.profilePage.goto();
        },
      );

      await test.step(
        "Добавляем навык «могу помочь»",
        async () => {
          await app.profilePage.addSkill(
            skill,
            "can_help",
          );
        },
      );

      await test.step(
        "Перезагружаем профиль",
        async () => {
          await app.page.reload();
        },
      );

      await test.step(
        "Навык остаётся в правильном блоке после reload",
        async () => {
          await expect(
            app.profilePage.skillItem(
              skill,
              "can_help",
            ),
          ).toBeVisible();
        },
      );
    },
  );

  test(
    "навык «хочу разобрать» сохраняется в своём блоке после перезагрузки",
    async ({ appFactory }) => {
      const runId = makeRunId("want-to-learn-persist");
      const user = makeUser("profile-user", runId);
      const skill = `PersistWantToLearn-${runId}`;
      const app = await appFactory();

      await test.step(
        "Arrange: создаём аккаунт через API и открываем профиль",
        async () => {
          await registerUserViaApi(
            app.context.request,
            user,
          );
          await app.profilePage.goto();
        },
      );

      await test.step(
        "Добавляем навык «хочу разобрать»",
        async () => {
          await app.profilePage.addSkill(
            skill,
            "want_to_learn",
          );
        },
      );

      await test.step(
        "Перезагружаем профиль",
        async () => {
          await app.page.reload();
        },
      );

      await test.step(
        "Навык остаётся только в блоке «хочу разобрать»",
        async () => {
          await expect(
            app.profilePage.skillItem(
              skill,
              "want_to_learn",
            ),
          ).toBeVisible();
          await expect(
            app.profilePage.canHelpSkills,
          ).not.toContainText(skill);
        },
      );
    },
  );

  test(
    "удаление одного навыка сохраняется после reload и не удаляет соседний",
    async ({ appFactory }) => {
      const runId = makeRunId("skill-remove");
      const user = makeUser("profile-user", runId);
      const removedSkill = `Remove-${runId}`;
      const retainedSkill = `Keep-${runId}`;
      const app = await appFactory();

      await test.step(
        "Arrange: создаём аккаунт и два навыка",
        async () => {
          await registerUserViaApi(
            app.context.request,
            user,
          );
          await app.profilePage.goto();
          await app.profilePage.addSkill(
            removedSkill,
            "can_help",
          );
          await app.profilePage.addSkill(
            retainedSkill,
            "can_help",
          );
        },
      );

      await test.step(
        "Удаляем только первый навык",
        async () => {
          await app.profilePage.removeSkill(
            removedSkill,
          );
        },
      );

      await test.step(
        "Перезагружаем профиль",
        async () => {
          await app.page.reload();
        },
      );

      await test.step(
        "Удалённый навык не возвращается, соседний остаётся",
        async () => {
          await expect(
            app.profilePage.skillItem(
              removedSkill,
              "can_help",
            ),
          ).toHaveCount(0);

          await expect(
            app.profilePage.skillItem(
              retainedSkill,
              "can_help",
            ),
          ).toBeVisible();
        },
      );
    },
  );
});
