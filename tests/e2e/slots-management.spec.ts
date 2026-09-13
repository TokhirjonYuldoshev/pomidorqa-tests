import { expect, test } from "../fixtures/app-fixtures";
import { makeRunId } from "../helpers/test-data";
import {
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

const TEST_TIMEOUT = 120_000;
const CATALOG_RESULT_TIMEOUT = 30_000;

function futureDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

test.describe("Свободные слоты: управление и изоляция", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT });

  test(
    "новый тестовый пользователь начинает без свободных слотов",
    async ({ appFactory }) => {
      const runId = makeRunId("slots-empty");
      const user = makeUser("slots-empty", runId);
      const app = await appFactory();

      await test.step(
        "Arrange: создаёт тестовый аккаунт через API",
        async () => {
          await registerUserViaApi(
            app.context.request,
            user,
          );
        },
      );

      await test.step(
        "Пользователь: открывает управление слотами",
        async () => {
          await app.slotsPage.goto();
        },
      );

      await test.step(
        "У нового аккаунта нет сохранённых слотов",
        async () => {
          await expect(app.slotsPage.slotCards).toHaveCount(0);
        },
      );
    },
  );

  test(
    "созданный слот сохраняется после reload",
    async ({ appFactory }) => {
      const runId = makeRunId("slot-reload");
      const user = makeUser("slot-reload", runId);
      const app = await appFactory();

      await test.step(
        "Arrange: создаёт тестовый аккаунт через API",
        async () => {
          await registerUserViaApi(
            app.context.request,
            user,
          );
        },
      );

      await test.step(
        "Пользователь: добавляет один будущий слот",
        async () => {
          await app.slotsPage.goto();
          await app.slotsPage.addSlot("12:00");
        },
      );

      await test.step(
        "После создания отображается ровно один слот",
        async () => {
          await expect(app.slotsPage.slotCards).toHaveCount(1);
        },
      );

      await test.step(
        "Пользователь: перезагружает страницу слотов",
        async () => {
          await app.page.reload();
        },
      );

      await test.step(
        "После reload слот загружен с сервера",
        async () => {
          await expect(app.slotsPage.slotCards).toHaveCount(1);
        },
      );
    },
  );

  test(
    "два разных времени одного дня сохраняются как два слота",
    async ({ appFactory }) => {
      const runId = makeRunId("two-times");
      const user = makeUser("two-times", runId);
      const app = await appFactory();

      await test.step(
        "Arrange: создаёт тестовый аккаунт через API",
        async () => {
          await registerUserViaApi(
            app.context.request,
            user,
          );
        },
      );

      await test.step(
        "Пользователь: добавляет два времени на один будущий день",
        async () => {
          await app.slotsPage.goto();
          await app.slotsPage.addSlot("12:00");
          await app.slotsPage.addSlot("13:00");
        },
      );

      await test.step(
        "На странице отображаются два независимых слота",
        async () => {
          await expect(app.slotsPage.slotCards).toHaveCount(2);
        },
      );

      await test.step(
        "Пользователь: перезагружает страницу",
        async () => {
          await app.page.reload();
        },
      );

      await test.step(
        "После reload оба слота сохраняются",
        async () => {
          await expect(app.slotsPage.slotCards).toHaveCount(2);
        },
      );
    },
  );

  test(
    "гость видит оба свободных времени одного дня",
    async ({ appFactory }) => {
      const runId = makeRunId("two-times-public");
      const skill = `TwoTimes-${runId}`;
      const host = makeUser("two-times-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await test.step(
        "Arrange: хост создаётся через API и публикует навык",
        async () => {
          await registerUserViaApi(
            hostApp.context.request,
            host,
          );
          await hostApp.profilePage.goto();
          await hostApp.profilePage.addSkill(
            skill,
            "can_help",
          );
        },
      );

      await test.step(
        "Хост: добавляет два времени на один день",
        async () => {
          await hostApp.slotsPage.goto();
          await hostApp.slotsPage.addSlot("12:00");
          await hostApp.slotsPage.addSlot("13:00");
        },
      );

      await test.step(
        "Гость: находит хоста и открывает его карточку",
        async () => {
          await guestApp.bookingPage.goToCatalog();
          await guestApp.bookingPage.searchCatalog(skill);
          await guestApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );
          await guestApp.bookingPage.openPerson(host.name);
        },
      );

      await test.step(
        "Для одного дня доступна одна календарная дата",
        async () => {
          await expect(
            guestApp.bookingPage.availableDayButtons,
          ).toHaveCount(1);
        },
      );

      await test.step(
        "Гость: открывает доступный день",
        async () => {
          await guestApp.bookingPage.availableDayButtons.click();
        },
      );

      await test.step(
        "Гостю доступны оба времени 12:00 и 13:00",
        async () => {
          await expect(
            guestApp.bookingPage.availableTimeButtons,
          ).toHaveCount(2);

          await expect(
            guestApp.bookingPage.availableTimeButtons.filter({
              hasText: "12:00",
            }),
          ).toHaveCount(1);

          await expect(
            guestApp.bookingPage.availableTimeButtons.filter({
              hasText: "13:00",
            }),
          ).toHaveCount(1);
        },
      );
    },
  );

  test(
    "слоты на двух будущих датах отображаются как два доступных дня",
    async ({ appFactory }) => {
      const runId = makeRunId("two-days");
      const skill = `TwoDays-${runId}`;
      const host = makeUser("two-days-host", runId);

      const hostApp = await appFactory();
      const guestApp = await appFactory();

      await test.step(
        "Arrange: хост создаётся через API и публикует навык",
        async () => {
          await registerUserViaApi(
            hostApp.context.request,
            host,
          );
          await hostApp.profilePage.goto();
          await hostApp.profilePage.addSkill(
            skill,
            "can_help",
          );
        },
      );

      await test.step(
        "Хост: создаёт слоты на завтра и послезавтра",
        async () => {
          await hostApp.slotsPage.goto();
          await hostApp.slotsPage.addSlot(
            "12:00",
            futureDate(1),
          );
          await hostApp.slotsPage.addSlot(
            "12:00",
            futureDate(2),
          );
        },
      );

      await test.step(
        "У хоста сохранены два слота",
        async () => {
          await expect(hostApp.slotsPage.slotCards).toHaveCount(2);
        },
      );

      await test.step(
        "Гость: находит и открывает карточку хоста",
        async () => {
          await guestApp.bookingPage.goToCatalog();
          await guestApp.bookingPage.searchCatalog(skill);
          await guestApp.bookingPage.waitForPersonInCatalog(
            host.name,
            skill,
            CATALOG_RESULT_TIMEOUT,
          );
          await guestApp.bookingPage.openPerson(host.name);
        },
      );

      await test.step(
        "Календарь показывает две доступные даты",
        async () => {
          await expect(
            guestApp.bookingPage.availableDayButtons,
          ).toHaveCount(2);
        },
      );
    },
  );

  test(
    "слоты одного аккаунта не появляются в управлении другого аккаунта",
    async ({ appFactory }) => {
      const runId = makeRunId("slot-isolation");
      const owner = makeUser("slot-owner", runId);
      const other = makeUser("slot-other", runId);

      const ownerApp = await appFactory();
      const otherApp = await appFactory();

      await test.step(
        "Arrange: создаёт два независимых аккаунта через API",
        async () => {
          await registerUserViaApi(
            ownerApp.context.request,
            owner,
          );
          await registerUserViaApi(
            otherApp.context.request,
            other,
          );
        },
      );

      await test.step(
        "Первый пользователь: создаёт свой слот",
        async () => {
          await ownerApp.slotsPage.goto();
          await ownerApp.slotsPage.addSlot("12:00");
        },
      );

      await test.step(
        "Контроль: у владельца отображается один слот",
        async () => {
          await expect(
            ownerApp.slotsPage.slotCards,
          ).toHaveCount(1);
        },
      );

      await test.step(
        "Второй пользователь: открывает собственное управление слотами",
        async () => {
          await otherApp.slotsPage.goto();
        },
      );

      await test.step(
        "У второго пользователя чужой слот отсутствует",
        async () => {
          await expect(
            otherApp.slotsPage.slotCards,
          ).toHaveCount(0);
        },
      );
    },
  );

  test(
    "слот сохраняется после перехода в профиль и возврата",
    async ({ appFactory }) => {
      const runId = makeRunId("slot-navigation");
      const user = makeUser("slot-navigation", runId);
      const app = await appFactory();

      await test.step(
        "Arrange: создаёт тестовый аккаунт через API",
        async () => {
          await registerUserViaApi(
            app.context.request,
            user,
          );
        },
      );

      await test.step(
        "Пользователь: создаёт будущий слот",
        async () => {
          await app.slotsPage.goto();
          await app.slotsPage.addSlot("12:00");
        },
      );

      await test.step(
        "Пользователь: уходит на страницу профиля",
        async () => {
          await app.profilePage.goto();
        },
      );

      await test.step(
        "Пользователь: возвращается к управлению слотами",
        async () => {
          await app.slotsPage.goto();
        },
      );

      await test.step(
        "После навигации созданный слот сохранён",
        async () => {
          await expect(app.slotsPage.slotCards).toHaveCount(1);
        },
      );
    },
  );
});
