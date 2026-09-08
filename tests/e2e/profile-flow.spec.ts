import { expect, test } from "@playwright/test";
import { makeUser, registerUser } from "../helpers/user";
import { ProfilePage } from "../pages/profile-page";

test.describe("Профиль: действия с полями", () => {
  let profilePage: ProfilePage;

  test.beforeEach(async ({ page }) => {
    const user = makeUser("profile");
    profilePage = new ProfilePage(page);
    await registerUser(page, user);
    await profilePage.goto();
  });

  test("имя сохраняется после перезагрузки", async ({ page }) => {
    const newName = `Тимур Тестович ${Date.now()}`;

    await test.step("Сохраняем новое имя", async () => {
      await profilePage.saveName(newName);
    });

    await test.step("Перезагружаем профиль", async () => {
      await page.reload();
    });

    await test.step("Имя загружено с сервера", async () => {
      await expect(profilePage.nameInput).toHaveValue(newName);
    });
  });

  test("часовой пояс сохраняется после перезагрузки", async ({ page }) => {
    const timezone = "Asia/Yekaterinburg";

    await test.step("Выбираем и сохраняем другой часовой пояс", async () => {
      await profilePage.saveTimezone(timezone);
    });

    await test.step("Перезагружаем профиль", async () => {
      await page.reload();
    });

    await test.step("Выбранный пояс загружен с сервера", async () => {
      await expect(profilePage.timezoneSelect).toHaveValue(timezone);
    });
  });

  test("telegram сохраняется после перезагрузки", async ({ page }) => {
    const telegram = `@qa_timur_${Date.now()}`;

    await test.step("Сохраняем Telegram", async () => {
      await profilePage.saveTelegram(telegram);
    });

    await test.step("Перезагружаем профиль", async () => {
      await page.reload();
    });

    await test.step("Telegram загружен с сервера", async () => {
      await expect(profilePage.telegramInput).toHaveValue(telegram);
    });
  });

  test("о себе сохраняется после перезагрузки", async ({ page }) => {
    const bio = `QA-инженер, прогон ${Date.now()}. Проверяю Playwright.`;

    await test.step("Сохраняем текст «О себе»", async () => {
      await profilePage.saveBio(bio);
    });

    await test.step("Перезагружаем профиль", async () => {
      await page.reload();
    });

    await test.step("Текст загружен с сервера", async () => {
      await expect(profilePage.bioInput).toHaveValue(bio);
    });
  });

  test("навык «могу помочь» добавляется в нужный блок", async () => {
    const skillTag = `Playwright-demo-${Date.now()}`;

    await test.step("Добавляем навык «могу помочь»", async () => {
      await profilePage.addSkill(skillTag, "can_help");
    });

    await test.step("Навык виден в блоке «могу помочь»", async () => {
      await expect(profilePage.canHelpSkillItem(skillTag)).toBeVisible();
    });
  });

  test("пустой навык не добавляется", async () => {
    await test.step("Пытаемся добавить пустой навык", async () => {
      await profilePage.attemptAddEmptySkill();
    });

    await test.step("Навыки не появились", async () => {
      await expect(profilePage.skillItems).toHaveCount(0);
      await expect(profilePage.canHelpSkills).not.toBeVisible();
    });
  });

  test("навык «хочу разобрать» не попадает в «могу помочь»", async () => {
    const runId = Date.now();
    const canHelpTag = `CanHelp-${runId}`;
    const wantToLearnTag = `WantToLearn-${runId}`;

    await test.step("Добавляем навыки разных типов", async () => {
      await profilePage.addSkill(canHelpTag, "can_help");
      await profilePage.addSkill(wantToLearnTag, "want_to_learn");
    });

    await test.step("Навыки находятся в своих блоках", async () => {
      await expect(profilePage.skillItems).toHaveCount(2);
      await expect(profilePage.canHelpSkillItem(canHelpTag)).toBeVisible();
      await expect(
        profilePage.skillItem(wantToLearnTag, "want_to_learn"),
      ).toBeVisible();
      await expect(profilePage.canHelpSkills).not.toContainText(wantToLearnTag);
    });
  });

  test("имя, telegram и о себе сохраняются одной отправкой", async ({ page }) => {
    const runId = Date.now();
    const name = `Тимур Тестовый ${runId}`;
    const telegram = `@qa_timur_${runId}`;
    const bio = `QA-инженер, прогон ${runId}. Проверяю форму профиля целиком.`;

    await test.step("Заполняем и сохраняем три поля", async () => {
      await profilePage.fillProfileForm(name, telegram, bio);
      await profilePage.saveProfile();
    });

    await test.step("Перезагружаем профиль", async () => {
      await page.reload();
    });

    await test.step("Все значения загружены с сервера", async () => {
      await expect.soft(profilePage.nameInput).toHaveValue(name);
      await expect.soft(profilePage.telegramInput).toHaveValue(telegram);
      await expect.soft(profilePage.bioInput).toHaveValue(bio);
    });
  });
});
