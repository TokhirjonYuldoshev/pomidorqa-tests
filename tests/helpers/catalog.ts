import { test } from "@playwright/test";
import type { AppContext } from "./booking";
import { registerUser, type TestUser } from "./user";

export function makeRunId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function registerWithSkill(
  app: AppContext,
  user: TestUser,
  skill: string,
): Promise<void> {
  await test.step(
    `${user.name}: регистрируется и добавляет навык ${skill}`,
    async () => {
      await registerUser(app.page, user);
      await app.profilePage.goto();
      await app.profilePage.addSkill(skill, "can_help");
    },
  );
}

export async function addFutureSlot(
  app: AppContext,
  participantName: string,
  time = "12:00",
): Promise<void> {
  await test.step(
    `${participantName}: добавляет будущий свободный слот`,
    async () => {
      await app.slotsPage.goto();
      await app.slotsPage.addSlot(time);
    },
  );
}

export async function prepareCatalogParticipant(
  app: AppContext,
  user: TestUser,
  skill: string,
  time = "12:00",
): Promise<void> {
  await registerWithSkill(app, user, skill);
  await addFutureSlot(app, user.name, time);
}
