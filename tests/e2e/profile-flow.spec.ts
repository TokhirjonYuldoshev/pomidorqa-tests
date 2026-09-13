import { expect, test } from "../fixtures/app-fixtures";
import { makeUniqueToken } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

test.describe("Профиль: действия с полями и навыками", () => {
  test.beforeEach(async ({ hostApp }) => {
    const user = makeUser("profile");

    await registerUserViaApi(
      hostApp.context.request,
      user,
    );

    await hostApp.profilePage.goto();
  });

  test("имя сохраняется после перезагрузки", async ({ hostApp }) => {
    const unique = makeUniqueToken();
    const newName = `Тимур Тестович ${unique}`;

    await test.step("Сохраняем новое имя", async () => {
      await hostApp.profilePage.saveName(newName);
    });

    await test.step("Перезагружаем профиль", async () => {
      await hostApp.page.reload();
    });

    await test.step("Имя загружено с сервера", async () => {
      await expect(hostApp.profilePage.nameInput).toHaveValue(newName);
    });
  });

  test("часовой пояс сохраняется после перезагрузки", async ({ hostApp }) => {
    const timezone = "Asia/Yekaterinburg";

    await test.step("Выбираем и сохраняем другой часовой пояс", async () => {
      await hostApp.profilePage.saveTimezone(timezone);
    });

    await test.step("Перезагружаем профиль", async () => {
      await hostApp.page.reload();
    });

    await test.step("Выбранный пояс загружен с сервера", async () => {
      await expect(hostApp.profilePage.timezoneSelect).toHaveValue(timezone);
    });
  });

  test("telegram сохраняется после перезагрузки", async ({ hostApp }) => {
    const unique = makeUniqueToken();
    const telegram = `@qa_timur_${unique}`;

    await test.step("Сохраняем Telegram", async () => {
      await hostApp.profilePage.saveTelegram(telegram);
    });

    await test.step("Перезагружаем профиль", async () => {
      await hostApp.page.reload();
    });

    await test.step("Telegram загружен с сервера", async () => {
      await expect(hostApp.profilePage.telegramInput).toHaveValue(telegram);
    });
  });

  test("о себе сохраняется после перезагрузки", async ({ hostApp }) => {
    const unique = makeUniqueToken();
    const bio = `QA-инженер, прогон ${unique}. Проверяю Playwright.`;

    await test.step("Сохраняем текст О себе", async () => {
      await hostApp.profilePage.saveBio(bio);
    });

    await test.step("Перезагружаем профиль", async () => {
      await hostApp.page.reload();
    });

    await test.step("Текст загружен с сервера", async () => {
      await expect(hostApp.profilePage.bioInput).toHaveValue(bio);
    });
  });

  test("навык могу помочь добавляется в нужный блок", async ({ hostApp }) => {
    const skillTag = `Playwright-demo-${makeUniqueToken()}`;

    await test.step("Добавляем навык могу помочь", async () => {
      await hostApp.profilePage.addSkill(skillTag, "can_help");
    });

    await test.step("Навык виден в блоке могу помочь", async () => {
      await expect(
        hostApp.profilePage.canHelpSkillItem(skillTag),
      ).toBeVisible();
    });
  });

  test("пустой навык не добавляется", async ({ hostApp }) => {
    await test.step("Пытаемся добавить пустой навык", async () => {
      await hostApp.profilePage.attemptAddEmptySkill();
    });

    await test.step("Навыки не появились", async () => {
      await expect(hostApp.profilePage.skillItems).toHaveCount(0);
      await expect(hostApp.profilePage.canHelpSkills).not.toBeVisible();
    });
  });

  test("навык хочу разобрать не попадает в могу помочь", async ({ hostApp }) => {
    const runId = makeUniqueToken();
    const canHelpTag = `CanHelp-${runId}`;
    const wantToLearnTag = `WantToLearn-${runId}`;

    await test.step("Добавляем навыки разных типов", async () => {
      await hostApp.profilePage.addSkill(canHelpTag, "can_help");
      await hostApp.profilePage.addSkill(
        wantToLearnTag,
        "want_to_learn",
      );
    });

    await test.step("Навыки находятся в своих блоках", async () => {
      await expect(hostApp.profilePage.skillItems).toHaveCount(2);
      await expect(
        hostApp.profilePage.canHelpSkillItem(canHelpTag),
      ).toBeVisible();
      await expect(
        hostApp.profilePage.skillItem(
          wantToLearnTag,
          "want_to_learn",
        ),
      ).toBeVisible();
      await expect(
        hostApp.profilePage.canHelpSkills,
      ).not.toContainText(wantToLearnTag);
    });
  });

  test("имя, telegram и о себе сохраняются одной отправкой", async ({
    hostApp,
  }) => {
    const runId = makeUniqueToken();
    const name = `Тимур Тестовый ${runId}`;
    const telegram = `@qa_timur_${runId}`;
    const bio = `QA-инженер, прогон ${runId}. Проверяю форму профиля целиком.`;

    await test.step("Заполняем и сохраняем три поля", async () => {
      await hostApp.profilePage.fillProfileForm(
        name,
        telegram,
        bio,
      );
      await hostApp.profilePage.saveProfile();
    });

    await test.step("Перезагружаем профиль", async () => {
      await hostApp.page.reload();
    });

    await test.step("Все значения загружены с сервера", async () => {
      await expect.soft(
        hostApp.profilePage.nameInput,
      ).toHaveValue(name);
      await expect.soft(
        hostApp.profilePage.telegramInput,
      ).toHaveValue(telegram);
      await expect.soft(
        hostApp.profilePage.bioInput,
      ).toHaveValue(bio);
    });
  });

  test("несколько навыков могу помочь сохраняются после reload", async ({
    hostApp,
  }) => {
    const runId = makeUniqueToken();
    const firstSkill = `API-${runId}`;
    const secondSkill = `Playwright-${runId}`;

    await test.step("Добавляем два навыка могу помочь", async () => {
      await hostApp.profilePage.addSkill(
        firstSkill,
        "can_help",
      );
      await hostApp.profilePage.addSkill(
        secondSkill,
        "can_help",
      );
    });

    await test.step("Перезагружаем профиль", async () => {
      await hostApp.page.reload();
    });

    await test.step("Оба навыка восстановлены с сервера без дублей", async () => {
      await expect(
        hostApp.profilePage.canHelpSkillItem(firstSkill),
      ).toHaveCount(1);
      await expect(
        hostApp.profilePage.canHelpSkillItem(secondSkill),
      ).toHaveCount(1);
      await expect(hostApp.profilePage.skillItems).toHaveCount(2);
    });
  });

  test("удаление одного навыка сохраняется и не удаляет соседний", async ({
    hostApp,
  }) => {
    const runId = makeUniqueToken();
    const removedSkill = `Removed-${runId}`;
    const keptSkill = `Kept-${runId}`;

    await test.step("Добавляем два навыка", async () => {
      await hostApp.profilePage.addSkill(
        removedSkill,
        "can_help",
      );
      await hostApp.profilePage.addSkill(
        keptSkill,
        "can_help",
      );
    });

    await test.step("Удаляем только первый навык", async () => {
      await hostApp.profilePage.removeSkill(removedSkill);
    });

    await test.step("Перезагружаем профиль", async () => {
      await hostApp.page.reload();
    });

    await test.step("Удалённый навык не вернулся, соседний сохранился", async () => {
      await expect(
        hostApp.profilePage.skillItem(
          removedSkill,
          "can_help",
        ),
      ).toHaveCount(0);
      await expect(
        hostApp.profilePage.canHelpSkillItem(keptSkill),
      ).toHaveCount(1);
    });
  });

  test("обновление имени не затирает telegram и о себе", async ({
    hostApp,
  }) => {
    const runId = makeUniqueToken();
    const initialName = `Исходное имя ${runId}`;
    const updatedName = `Новое имя ${runId}`;
    const telegram = `@preserve_${runId}`;
    const bio = `Сохраняем соседние поля ${runId}`;

    await test.step("Сохраняем исходный набор полей", async () => {
      await hostApp.profilePage.fillProfileForm(
        initialName,
        telegram,
        bio,
      );
      await hostApp.profilePage.saveProfile();
    });

    await test.step(
      "Подтверждаем исходный набор полей с сервера",
      async () => {
        await hostApp.page.reload();

        await expect.soft(
          hostApp.profilePage.nameInput,
        ).toHaveValue(initialName);
        await expect.soft(
          hostApp.profilePage.telegramInput,
        ).toHaveValue(telegram);
        await expect.soft(
          hostApp.profilePage.bioInput,
        ).toHaveValue(bio);
      },
    );

    await test.step("Меняем только имя", async () => {
      await hostApp.profilePage.saveName(updatedName);
    });

    await test.step("Перезагружаем профиль", async () => {
      await hostApp.page.reload();
    });

    await test.step("Имя обновилось, остальные поля не потеряны", async () => {
      await expect.soft(
        hostApp.profilePage.nameInput,
      ).toHaveValue(updatedName);
      await expect.soft(
        hostApp.profilePage.telegramInput,
      ).toHaveValue(telegram);
      await expect.soft(
        hostApp.profilePage.bioInput,
      ).toHaveValue(bio);
    });
  });

  test("навыки разных типов сохраняются независимо после reload", async ({
    hostApp,
  }) => {
    const runId = makeUniqueToken();
    const canHelpSkill = `Mentor-${runId}`;
    const wantToLearnSkill = `Learn-${runId}`;

    await test.step("Добавляем по одному навыку каждого типа", async () => {
      await hostApp.profilePage.addSkill(
        canHelpSkill,
        "can_help",
      );
      await hostApp.profilePage.addSkill(
        wantToLearnSkill,
        "want_to_learn",
      );
    });

    await test.step("Перезагружаем профиль", async () => {
      await hostApp.page.reload();
    });

    await test.step("Каждый навык остаётся в своём типе", async () => {
      await expect(
        hostApp.profilePage.skillItem(
          canHelpSkill,
          "can_help",
        ),
      ).toHaveCount(1);
      await expect(
        hostApp.profilePage.skillItem(
          wantToLearnSkill,
          "want_to_learn",
        ),
      ).toHaveCount(1);
    });
  });

  test("последнее сохранённое значение поля остаётся после reload", async ({
    hostApp,
  }) => {
    const runId = makeUniqueToken();
    const firstBio = `Первая версия ${runId}`;
    const secondBio = `Вторая версия ${runId}`;

    await test.step("Сохраняем первую версию О себе", async () => {
      await hostApp.profilePage.saveBio(firstBio);
    });

    await test.step("Сохраняем вторую версию О себе", async () => {
      await hostApp.profilePage.saveBio(secondBio);
    });

    await test.step("Перезагружаем профиль", async () => {
      await hostApp.page.reload();
    });

    await test.step("С сервера загружена последняя версия", async () => {
      await expect(hostApp.profilePage.bioInput).toHaveValue(secondBio);
      await expect(hostApp.profilePage.bioInput).not.toHaveValue(firstBio);
    });
  });
});
