import { expect, test } from "../fixtures/app-fixtures";
import { slotFormValues } from "../helpers/slot-time";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

test.describe("Слоты: правила MVP", () => {
  test("дату в прошлом форма не отправляет", async ({ appFactory }) => {
    const app = await appFactory();
    const user = makeUser("slot-past", makeRunId("slot-past"));

    await registerUserViaApi(app.context.request, user);
    await app.slotsPage.goto();

    const pastDate = slotFormValues(-48 * 60 * 60 * 1000).date;

    await app.slotsPage.submitSlot("12:00", pastDate);

    expect(
      await app.slotsPage.dateInput.evaluate(
        (input) => input.validity.valid,
      ),
    ).toBe(false);
    await expect(app.slotsPage.slotCards).toHaveCount(0);
  });

  test("свободный слот можно удалить, соседний остаётся", async ({
    appFactory,
  }) => {
    const app = await appFactory();
    const user = makeUser("slot-delete", makeRunId("slot-delete"));

    await registerUserViaApi(app.context.request, user);
    await app.slotsPage.goto();
    await app.slotsPage.addSlot("09:00");
    await app.slotsPage.addSlot("10:00");

    await expect(
      app.slotsPage.slotCard("09:00"),
    ).toHaveAttribute("data-slot-status", "free");

    await app.slotsPage.deleteSlot("09:00");
    await app.page.reload();

    await expect(app.slotsPage.slotCard("09:00")).toHaveCount(0);
    await expect(app.slotsPage.slotCard("10:00")).toBeVisible();
  });

  test("забронированный слот имеет status booked и не удаляется из UI", async ({
    appFactory,
  }) => {
    test.setTimeout(120_000);

    const runId = makeRunId("booked-slot");
    const host = makeUser("booked-host", runId);
    const guest = makeUser("booked-guest", runId);
    const skill = `BookedSlot-${runId}`;
    const hostApp = await appFactory();
    const guestApp = await appFactory();

    await registerUserViaApi(hostApp.context.request, host);
    await hostApp.profilePage.goto();
    await hostApp.profilePage.addSkill(skill, "can_help");
    await hostApp.slotsPage.goto();
    await hostApp.slotsPage.addSlot("11:00");

    await expect(
      hostApp.slotsPage.slotCard("11:00"),
    ).toHaveAttribute("data-slot-status", "free");

    await registerUserViaApi(guestApp.context.request, guest);
    await guestApp.bookingPage.goToCatalog();
    await guestApp.bookingPage.searchCatalog(skill);
    await guestApp.bookingPage.waitForPersonInCatalog(
      host.name,
      skill,
    );
    await guestApp.bookingPage.openPerson(host.name);
    await guestApp.bookingPage.pickOnlyAvailableSlot();
    await guestApp.bookingPage.confirmBooking();

    expect(
      await guestApp.bookingPage.waitForBookingResult(),
    ).toEqual({ status: "success" });

    await expect
      .poll(
        async () => {
          await hostApp.page.reload();
          return hostApp.slotsPage
            .slotCard("11:00")
            .getAttribute("data-slot-status");
        },
        {
          timeout: 15_000,
          intervals: [500, 1_000, 2_000],
        },
      )
      .toBe("booked");

    await expect(
      hostApp.slotsPage.slotDeleteButton("11:00"),
    ).toHaveCount(0);
  });
});
