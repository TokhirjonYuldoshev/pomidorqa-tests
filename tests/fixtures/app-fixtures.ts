import { test as base } from "@playwright/test";
import {
  closeApps,
  createApp,
  type AppContext,
} from "../helpers/booking";

export type AppFactory = () => Promise<AppContext>;

type AppFixtures = {
  appFactory: AppFactory;
  hostApp: AppContext;
  guestApp: AppContext;
  guest2App: AppContext;
};

export const test = base.extend<AppFixtures>({
  appFactory: async ({ browser }, use) => {
    const apps: AppContext[] = [];

    const createFixtureApp: AppFactory = async () => {
      const app = await createApp(browser);

      apps.push(app);

      return app;
    };

    try {
      await use(createFixtureApp);
    } finally {
      await closeApps(apps);
    }
  },

  hostApp: async ({ appFactory }, use) => {
    const hostApp = await appFactory();

    await use(hostApp);
  },

  guestApp: async ({ appFactory }, use) => {
    const guestApp = await appFactory();

    await use(guestApp);
  },

  guest2App: async ({ appFactory }, use) => {
    const guest2App = await appFactory();

    await use(guest2App);
  },
});

export { expect } from "@playwright/test";
