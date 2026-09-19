import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";
import { PersonPage } from "../pages/person-page";

test("публичный профиль показывает сохранённые данные и оба типа навыков", async ({
  appFactory,
}) => {
  test.setTimeout(120_000);

  const runId = makeRunId("public-profile");
  const host = makeUser("public-profile", runId);
  const telegram = `@public_${runId}`;
  const bio = `Публичное описание ${runId}`;
  const canHelpSkill = `PublicHelp-${runId}`;
  const wantToLearnSkill = `PublicLearn-${runId}`;
  const hostApp = await appFactory();
  const viewerApp = await appFactory();
  const person = new PersonPage(viewerApp.page);

  await test.step("Хост заполняет профиль", async () => {
    await registerUserViaApi(hostApp.context.request, host);
    await hostApp.profilePage.goto();
    await hostApp.profilePage.fillProfileForm(host.name, telegram, bio);
    await hostApp.profilePage.saveProfile();
    await hostApp.profilePage.addSkill(canHelpSkill, "can_help");
    await hostApp.profilePage.addSkill(
      wantToLearnSkill,
      "want_to_learn",
    );
    await hostApp.slotsPage.goto();
    await hostApp.slotsPage.addSlot("15:00");
  });

  await test.step("Другой пользователь открывает профиль из каталога", async () => {
    await viewerApp.bookingPage.goToCatalog();
    await viewerApp.bookingPage.searchCatalog(canHelpSkill);
    await viewerApp.bookingPage.waitForPersonInCatalog(
      host.name,
      canHelpSkill,
    );
    await viewerApp.bookingPage.openPerson(host.name);
  });

  await test.step("Публичная страница содержит данные профиля", async () => {
    await expect(person.name).toHaveText(host.name);
    await expect(person.content).toContainText(telegram);
    await expect(person.content).toContainText(bio);
    await expect(person.canHelpSection).toContainText(canHelpSkill);
    await expect(person.wantToLearnSection).toContainText(
      wantToLearnSkill,
    );
    await expect(
      viewerApp.bookingPage.availableDayButtons,
    ).toHaveCount(1);
  });
});
