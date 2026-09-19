export const DEFAULT_PROFILE_TIMEZONE = "Europe/Moscow";

export type SlotFormValues = {
  date: string;
  time: string;
};

export function slotFormValues(
  offsetMs: number,
  timeZone: string = DEFAULT_PROFILE_TIMEZONE,
): SlotFormValues {
  const instant = new Date(Date.now() + offsetMs);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);

  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const hour = String(Number(value("hour")) % 24).padStart(2, "0");

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${hour}:${value("minute")}`,
  };
}
