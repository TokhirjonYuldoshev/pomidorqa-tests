import {
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { BookingPage } from "../pages/booking-page";
import { ProfilePage } from "../pages/profile-page";
import { SlotsPage } from "../pages/slots-page";
import { deleteCurrentTestUser } from "./user";

export type AppContext = {
  context: BrowserContext;
  page: Page;
  bookingPage: BookingPage;
  profilePage: ProfilePage;
  slotsPage: SlotsPage;
};

export async function createApp(
  browser: Browser,
): Promise<AppContext> {
  const context = await browser.newContext();

  try {
    const page = await context.newPage();

    return {
      context,
      page,
      bookingPage: new BookingPage(page),
      profilePage: new ProfilePage(page),
      slotsPage: new SlotsPage(page),
    };
  } catch (setupError) {
    try {
      await context.close();
    } catch (cleanupError) {
      throw new AggregateError(
        [setupError, cleanupError],
        "Не удалось создать AppContext и закрыть browser context после ошибки setup",
      );
    }

    throw setupError;
  }
}

async function cleanupAndCloseApp(app: AppContext): Promise<void> {
  const failures: unknown[] = [];

  try {
    await deleteCurrentTestUser(app.context.request);
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      await app.context.close();
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Не удалось полностью очистить тестовый AppContext: ${failures.length} ошибка(и)`,
    );
  }
}

export async function closeApps(
  apps: readonly AppContext[],
): Promise<void> {
  const results = await Promise.allSettled(
    apps.map((app) => cleanupAndCloseApp(app)),
  );

  const failures = results
    .filter(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    )
    .map((result) => result.reason);

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Не удалось очистить и закрыть AppContext: ${failures.length} из ${apps.length}`,
    );
  }
}
