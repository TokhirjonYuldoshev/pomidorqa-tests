import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

test.describe("Профиль и навыки: требования MVP", () => {
  test.beforeEach(async ({ hostApp }) => {
    const user = makeUser("profile-rules", makeRunId("profile-rules"));

    await registerUserViaApi(hostApp.context.request, user);
    await hostApp.profilePage.goto();
  });

  test("имя обязательно, Telegram и О себе можно оставить пустыми", async ({
    hostApp,
  }) => {
    await test.step("Очищаем необязательные поля и сохраняем", async () => {
      await hostApp.profilePage.telegramInput.fill("");
      await hostApp.profilePage.bioInput.fill("");
      await hostApp.profilePage.saveProfile();
    });

    await test.step("Пустые Telegram и О себе сохраняются", async () => {
      await expect(hostApp.profilePage.telegramInput).toHaveValue("");
      await expect(hostApp.profilePage.bioInput).toHaveValue("");
    });

    await test.step("Пытаемся сохранить профиль без имени", async () => {
      await hostApp.profilePage.nameInput.fill("");
      await hostApp.profilePage.attemptSaveProfile();
    });

    await test.step("Браузерная валидация блокирует пустое имя", async () => {
      expect(
        await hostApp.profilePage.nameInput.evaluate(
          (input) => input.validity.valid,
        ),
      ).toBe(false);
    });
  });

  test("повторный навык того же типа не создаёт дубль", async ({
    hostApp,
  }) => {
    const skill = `Duplicate-${makeRunId("duplicate-skill")}`;

    await hostApp.profilePage.addSkill(skill, "can_help");
    await hostApp.profilePage.submitSkill(skill, "can_help");
    await hostApp.page.reload();

    await expect(
      hostApp.profilePage.skillItem(skill, "can_help"),
    ).toHaveCount(1);
  });

  test("одинаковый текст навыка разрешён в двух разных типах", async ({
    hostApp,
  }) => {
    const skill = `BothTypes-${makeRunId("both-types")}`;

    await hostApp.profilePage.addSkill(skill, "can_help");
    await hostApp.profilePage.submitSkill(skill, "want_to_learn");
    await hostApp.page.reload();

    await expect(
      hostApp.profilePage.skillsSection("can_help"),
    ).toContainText(skill);
    await expect(
      hostApp.profilePage.skillsSection("want_to_learn"),
    ).toContainText(skill);
  });
});
