import { expect, test } from "../fixtures/app-fixtures";
import {
  DEFAULT_PROFILE_TIMEZONE,
  slotFormValues,
} from "../helpers/slot-time";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

test("владелец и гость видят слот во времени владельца", async ({
  appFactory,
}) => {
  test.setTimeout(120_000);

  const runId = makeRunId("slot-timezone");
  const host = makeUser("tz-host", runId);
  const skill = `Timezone-${runId}`;
  const hostApp = await appFactory();
  const guestApp = await appFactory();
  const slotTime = "12:00";
  const { date } = slotFormValues(24 * 60 * 60 * 1000);

  await registerUserViaApi(hostApp.context.request, host);
  await hostApp.profilePage.goto();
  await hostApp.profilePage.addSkill(skill, "can_help");
  await hostApp.slotsPage.goto();
  await hostApp.slotsPage.addSlot(slotTime, date);

  await expect(hostApp.slotsPage.slotCard(slotTime)).toBeVisible();

  await guestApp.bookingPage.goToCatalog();
  await guestApp.bookingPage.searchCatalog(skill);
  await guestApp.bookingPage.waitForPersonInCatalog(host.name, skill);
  await guestApp.bookingPage.openPerson(host.name);
  await guestApp.bookingPage.availableDayButtons.first().click();

  await expect(
    guestApp.bookingPage.availableTimeButtons.first(),
  ).toHaveText(slotTime);
  await expect(
    guestApp.bookingPage.calendarTimezoneHint,
  ).toContainText(DEFAULT_PROFILE_TIMEZONE);
});
