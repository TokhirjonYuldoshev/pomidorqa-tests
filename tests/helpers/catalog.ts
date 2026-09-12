import { test } from "@playwright/test";
import type { SkillType } from "../pages/profile-page";
import type { AppContext } from "./booking";
import {
  registerUserViaApi,
  type TestUser,
} from "./user";

export async function registerWithSkill(
  app: AppContext,
  user: TestUser,
  skill: string,
  type: SkillType = "can_help",
): Promise<void> {
  await test.step(
    `${user.name}: создаёт аккаунт через API и добавляет навык ${skill}`,
    async () => {
      await registerUserViaApi(app.context.request, user);
      await app.profilePage.goto();
      await app.profilePage.addSkill(skill, type);
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

export async function prepareCatalogParticipantWithSkills(
  app: AppContext,
  user: TestUser,
  skills: readonly string[],
  time = "12:00",
): Promise<void> {
  await test.step(
    `${user.name}: создаёт аккаунт через API и добавляет несколько навыков`,
    async () => {
      await registerUserViaApi(app.context.request, user);
      await app.profilePage.goto();

      for (const skill of skills) {
        await app.profilePage.addSkill(skill, "can_help");
      }
    },
  );

  await addFutureSlot(app, user.name, time);
}
