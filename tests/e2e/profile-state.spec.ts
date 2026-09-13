import { expect, test } from "../fixtures/app-fixtures";
import { makeUniqueToken } from "../helpers/test-data";
import { makeUser, registerUserViaApi } from "../helpers/user";

test.describe("Профиль: состояние навыков", () => {
  test("навык «могу помочь» сохраняется после перезагрузки", async ({
    appFactory,
  }) => {
    const app = await appFactory();
    const user = makeUser("profile-state");
    const skill = `CanHelp-${makeUniqueToken()}`;

    await registerUserViaApi(app.context.request, user);
    await app.profilePage.goto();

    await test.step("Добавляем навык «могу помочь»", async () => {
      await app.profilePage.addSkill(skill, "can_help");
    });

    await test.step("Перезагружаем профиль", async () => {
      await app.page.reload();
    });

    await test.step("Навык загружен с сервера в правильном блоке", async () => {
      await expect(app.profilePage.canHelpSkillItem(skill)).toBeVisible();
    });
  });

  test("навык «хочу разобрать» сохраняется после перезагрузки", async ({
    appFactory,
  }) => {
    const app = await appFactory();
    const user = makeUser("profile-state");
    const skill = `WantToLearn-${makeUniqueToken()}`;

    await registerUserViaApi(app.context.request, user);
    await app.profilePage.goto();

    await test.step("Добавляем навык «хочу разобрать»", async () => {
      await app.profilePage.addSkill(skill, "want_to_learn");
    });

    await test.step("Перезагружаем профиль", async () => {
      await app.page.reload();
    });

    await test.step("Навык загружен с сервера в правильном блоке", async () => {
      await expect(
        app.profilePage.skillItem(skill, "want_to_learn"),
      ).toBeVisible();
      await expect(app.profilePage.canHelpSkills).not.toContainText(skill);
    });
  });

  test("удалённый навык не возвращается после перезагрузки", async ({
    appFactory,
  }) => {
    const app = await appFactory();
    const user = makeUser("profile-state");
    const skill = `Remove-${makeUniqueToken()}`;

    await registerUserViaApi(app.context.request, user);
    await app.profilePage.goto();

    await test.step("Добавляем навык", async () => {
      await app.profilePage.addSkill(skill, "can_help");
      await expect(app.profilePage.canHelpSkillItem(skill)).toBeVisible();
    });

    await test.step("Удаляем навык", async () => {
      await app.profilePage.removeSkill(skill);
    });

    await test.step("Перезагружаем профиль", async () => {
      await app.page.reload();
    });

    await test.step("Удалённый навык отсутствует", async () => {
      await expect(app.profilePage.skillItems.filter({ hasText: skill })).toHaveCount(0);
    });
  });

  test("удаление одного навыка не удаляет другой", async ({ appFactory }) => {
    const app = await appFactory();
    const user = makeUser("profile-state");
    const runId = makeUniqueToken();
    const removedSkill = `RemoveOne-${runId}`;
    const keptSkill = `KeepOne-${runId}`;

    await registerUserViaApi(app.context.request, user);
    await app.profilePage.goto();

    await test.step("Добавляем два навыка", async () => {
      await app.profilePage.addSkill(removedSkill, "can_help");
      await app.profilePage.addSkill(keptSkill, "can_help");
    });

    await test.step("Удаляем только первый навык", async () => {
      await app.profilePage.removeSkill(removedSkill);
    });

    await test.step("Перезагружаем профиль", async () => {
      await app.page.reload();
    });

    await test.step("Первый навык удалён, второй сохранён", async () => {
      await expect(
        app.profilePage.skillItems.filter({ hasText: removedSkill }),
      ).toHaveCount(0);
      await expect(app.profilePage.canHelpSkillItem(keptSkill)).toBeVisible();
    });
  });
});
