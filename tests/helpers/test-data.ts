import { randomUUID } from "node:crypto";

export function makeUniqueToken(): string {
  const randomPart = randomUUID().replaceAll("-", "").slice(0, 8);

  return `${Date.now()}${randomPart}`;
}

export function makeRunId(prefix: string): string {
  return `${prefix}-${makeUniqueToken()}`;
}
