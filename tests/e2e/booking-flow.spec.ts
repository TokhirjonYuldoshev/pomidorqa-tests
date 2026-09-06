import { test, expect, type Locator, type Page } from "@playwright/test";

type TestUser = {
  name: string;
  email: string;
  password: string;
};

function makeUser(role: string, runId: number): TestUser {
  return {
    name: `${role}-${runId} Автотест`,
    email: `${role}-${runId}@example.com`,
    password: "testpass123",
  };
}

const registerNameInput = (page: Page) => page.getByLabel("Имя");
const registerEmailInput = (page: Page) => page.getByLabel("Email");
const registerPasswordInput = (page: Page) => page.getByLabel("Пароль");
const registerSubmitButton = (page: Page) =>
  page.getByRole("button", { name: "Зарегистрироваться" });

const profileSkillInput = (page: Page) =>
  page.locator("#pomidorqa-profile-skill-input");
const profileSkillTypeSelect = (page: Page) =>
  page.locator("#pomidorqa-profile-skill-type");
const profileSkillSubmit = (page: Page) =>
  page.getByRole("button", { name: "Добавить" });
const profileCanHelpSkills = (page: Page) => page.getByTestId("can-help-skills");

const slotsDateInput = (page: Page) => page.locator("#pomidorqa-slots-date");
const slotsTimeInput = (page: Page) => page.locator("#pomidorqa-slots-time");
const slotsAddSubmit = (page: Page) =>
  page.getByRole("button", { name: "Добавить слот" });
const slotsCard = (page: Page) => page.locator("[data-slot-id]");

const catalogFilterInput = (page: Page) =>
  page.locator("#pomidorqa-catalog-skill-filter");
const catalogFilterSubmit = (page: Page) =>
  page.getByRole("button", { name: "Найти" });
const catalogCard = (page: Page) => page.getByTestId("person-card");

const personName = (page: Page) => page.getByRole("heading", { level: 1 });

const bookingCalendarDay = (page: Page) =>
  page.getByRole("group", { name: "Дни со слотами" }).getByRole("button");
const bookingCalendarTime = (page: Page, time: string) =>
  page
    .getByRole("group", { name: "Время слотов" })
    .getByRole("button", { name: time, exact: true });

const bookingConfirmDialog = (page: Page) => page.getByRole("dialog");
const bookingConfirmButton = (page: Page) =>
  bookingConfirmDialog(page).getByRole("button", { name: "Подтвердить" });
const bookingConfirmSuccess = (page: Page) =>
  bookingConfirmDialog(page).getByRole("status");
const bookingConfirmError = (page: Page) =>
  bookingConfirmDialog(page).getByRole("alert");

const bookingsUpcomingSection = (page: Page) =>
  page.getByTestId("upcoming-meetings");
const bookingByParticipant = (page: Page, participantName: string) =>
  bookingsUpcomingSection(page)
    .locator("[data-booking-id]")
    .filter({ hasText: participantName });

async function registerUser(page: Page, user: TestUser) {
  await page.goto("/pomidorqa/auth/register");
  await registerNameInput(page).fill(user.name);
  await registerEmailInput(page).fill(user.email);
  await registerPasswordInput(page).fill(user.password);
  await registerSubmitButton(page).click();
  await expect(page).toHaveURL(/\/pomidorqa\/?$/);
}

async function openPersonCard(
  page: Page,
  card: Locator,
  expectedName: string,
) {
  await Promise.all([
    page.waitForURL(
      (url) => url.pathname.startsWith("/pomidorqa/people/"),
      { waitUntil: "load" },
    ),
    card.click(),
  ]);

  await expect(personName(page)).toHaveText(expectedName);
  await expect(bookingCalendarDay(page).first()).toBeVisible({ timeout: 10_000 });
}

async function openBookingDialog(page: Page, time: string) {
  const day = bookingCalendarDay(page).first();
  const timeButton = bookingCalendarTime(page, time);

  await expect(day).toBeVisible({ timeout: 10_000 });
  await day.click();

  await expect(timeButton).toBeVisible({ timeout: 10_000 });
  await timeButton.click();

  await expect(bookingConfirmDialog(page)).toBeVisible({ timeout: 10_000 });
}

test("основной путь + гонка за слот: регистрация → навык → слот → поиск в каталоге → бронирование → «Мои встречи» у обоих → второй гость видит ошибку", async ({
  browser,
}) => {
  const runId = Date.now();
  const skillTag = `Playwright-demo-${runId}`;
  const slotTime = "12:00";
  const host = makeUser("host", runId);
  const guest = makeUser("guest", runId);
  const guest2 = makeUser("guest2", runId);

  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const guest2Context = await browser.newContext();

  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();
  const guest2Page = await guest2Context.newPage();

  try {
    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUser(hostPage, host);
    });

    await test.step('Хост: добавляет навык «могу помочь» в профиле', async () => {
      await hostPage.goto("/pomidorqa/profile");
      await profileSkillInput(hostPage).fill(skillTag);
      await profileSkillTypeSelect(hostPage).selectOption("can_help");
      await profileSkillSubmit(hostPage).click();
      await expect(profileCanHelpSkills(hostPage)).toContainText(skillTag);
    });

    await test.step("Хост: добавляет свободный слот на завтра", async () => {
      await hostPage.goto("/pomidorqa/profile/slots");
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const date = tomorrow.toISOString().slice(0, 10);
      await slotsDateInput(hostPage).fill(date);
      await slotsTimeInput(hostPage).fill(slotTime);
      await slotsAddSubmit(hostPage).click();
      await expect(slotsCard(hostPage).first()).toBeVisible();
    });

    await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
      await registerUser(guestPage, guest);
    });

    await test.step("Гость: ищет хоста в каталоге по навыку", async () => {
      await catalogFilterInput(guestPage).fill(skillTag);
      await catalogFilterSubmit(guestPage).click();
      await expect(
        catalogCard(guestPage).filter({ hasText: host.name }),
      ).toBeVisible();
    });

    await test.step("Гость: открывает карточку хоста", async () => {
      await openPersonCard(
        guestPage,
        catalogCard(guestPage).filter({ hasText: host.name }),
        host.name,
      );
    });

    await test.step("Гость: открывает окно бронирования конкретного слота", async () => {
      await openBookingDialog(guestPage, slotTime);
    });

    // Guest2 opens the same slot before guest confirms it.
    // This preserves the race-condition scenario from the original test.
    await test.step("Гость2: открывает окно бронирования на тот же слот", async () => {
      await registerUser(guest2Page, guest2);

      await catalogFilterInput(guest2Page).fill(skillTag);
      await catalogFilterSubmit(guest2Page).click();

      await openPersonCard(
        guest2Page,
        catalogCard(guest2Page).filter({ hasText: host.name }),
        host.name,
      );

      await openBookingDialog(guest2Page, slotTime);
    });

    await test.step("Гость: подтверждает бронирование первым — успех", async () => {
      await bookingConfirmButton(guestPage).click();

      const success = bookingConfirmSuccess(guestPage);
      const error = bookingConfirmError(guestPage);
      await expect(success.or(error)).toBeVisible({ timeout: 15_000 });

      if (await error.isVisible()) {
        throw new Error(`Бронирование не удалось: ${await error.textContent()}`);
      }
    });

    await test.step("Гость2: пытается забронировать тот же слот вторым — видит ошибку", async () => {
      await bookingConfirmButton(guest2Page).click();

      const success = bookingConfirmSuccess(guest2Page);
      const error = bookingConfirmError(guest2Page);
      await expect(success.or(error)).toBeVisible({ timeout: 15_000 });

      if (await success.isVisible()) {
        throw new Error("Слот должен был быть занят, но бронирование прошло успешно");
      }

      await expect(error).toBeVisible();
    });

    await test.step("Гость: видит бронирование в разделе «Мои встречи»", async () => {
      await guestPage.goto("/pomidorqa/bookings");
      await expect(bookingsUpcomingSection(guestPage)).toBeVisible();
      await expect(bookingByParticipant(guestPage, host.name)).toBeVisible({
        timeout: 10_000,
      });
    });

    await test.step("Хост: тоже видит бронирование в своих «Мои встречи»", async () => {
      await hostPage.goto("/pomidorqa/bookings");
      await expect(bookingsUpcomingSection(hostPage)).toBeVisible();
      await expect(bookingByParticipant(hostPage, guest.name)).toBeVisible({
        timeout: 10_000,
      });
    });
  } finally {
    await Promise.allSettled([
      hostContext.close(),
      guestContext.close(),
      guest2Context.close(),
    ]);
  }
});
