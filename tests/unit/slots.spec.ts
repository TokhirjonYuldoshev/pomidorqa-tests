import { expect, test } from "@playwright/test";
import {
  formatSlotTime,
  slotsOverlap,
  type TimeRange,
} from "../../src/pyramid/slots";

test.describe("Unit: пересечение слотов по времени", () => {
  test("пересекающиеся слоты", () => {
    const slotA: TimeRange = {
      start: new Date("2026-08-01T10:00:00"),
      end: new Date("2026-08-01T10:25:00"),
    };
    const slotB: TimeRange = {
      start: new Date("2026-08-01T10:10:00"),
      end: new Date("2026-08-01T10:35:00"),
    };

    expect(slotsOverlap(slotA, slotB)).toBe(true);
  });

  test("соседние слоты не пересекаются", () => {
    const slotA: TimeRange = {
      start: new Date("2026-08-01T10:00:00"),
      end: new Date("2026-08-01T10:25:00"),
    };
    const slotB: TimeRange = {
      start: new Date("2026-08-01T10:25:00"),
      end: new Date("2026-08-01T10:50:00"),
    };

    expect(slotsOverlap(slotA, slotB)).toBe(false);
  });

  test("разнесённые по времени слоты не пересекаются", () => {
    const slotA: TimeRange = {
      start: new Date("2026-08-01T10:00:00"),
      end: new Date("2026-08-01T10:25:00"),
    };
    const slotB: TimeRange = {
      start: new Date("2026-08-01T14:00:00"),
      end: new Date("2026-08-01T14:25:00"),
    };

    expect(slotsOverlap(slotA, slotB)).toBe(false);
  });

  test("слот A целиком позже слота B и не пересекается", () => {
    const slotA: TimeRange = {
      start: new Date("2026-08-01T14:00:00"),
      end: new Date("2026-08-01T14:25:00"),
    };
    const slotB: TimeRange = {
      start: new Date("2026-08-01T10:00:00"),
      end: new Date("2026-08-01T10:25:00"),
    };

    expect(slotsOverlap(slotA, slotB)).toBe(false);
  });

  test("вложенный слот пересекается", () => {
    const slotA: TimeRange = {
      start: new Date("2026-08-01T10:00:00"),
      end: new Date("2026-08-01T11:00:00"),
    };
    const slotB: TimeRange = {
      start: new Date("2026-08-01T10:15:00"),
      end: new Date("2026-08-01T10:45:00"),
    };

    expect(slotsOverlap(slotA, slotB)).toBe(true);
  });

  test("совпадающие диапазоны пересекаются", () => {
    const slotA: TimeRange = {
      start: new Date("2026-08-01T10:00:00"),
      end: new Date("2026-08-01T10:25:00"),
    };
    const slotB: TimeRange = {
      start: new Date("2026-08-01T10:00:00"),
      end: new Date("2026-08-01T10:25:00"),
    };

    expect(slotsOverlap(slotA, slotB)).toBe(true);
  });
});

test.describe("Unit: отображение времени слота", () => {
  const slotStart = new Date("2026-08-01T07:00:00Z");

  test("один момент отображается по-разному в разных поясах", () => {
    expect(formatSlotTime(slotStart, "Europe/Moscow")).toBe("10:00");
    expect(formatSlotTime(slotStart, "Asia/Yekaterinburg")).toBe("12:00");
  });

  test("формат содержит только часы и минуты", () => {
    expect(formatSlotTime(slotStart, "Europe/Moscow")).toMatch(/^\d{2}:\d{2}$/);
  });
});
