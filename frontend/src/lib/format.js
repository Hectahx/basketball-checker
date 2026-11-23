export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TZ = "Europe/London";

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const longDayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});
const keyFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });
const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

export const formatDay = (value) => dayFormat.format(new Date(value));
export const formatLongDay = (value) => longDayFormat.format(new Date(value));
export const formatTime = (value) => timeFormat.format(new Date(value));
export const formatDateTime = (value) => dateTimeFormat.format(new Date(value));

/** The London calendar date of a timestamp, as YYYY-MM-DD. */
export const dayKey = (value) => keyFormat.format(new Date(value));

export function addMinutes(value, minutes) {
  return new Date(new Date(value).getTime() + minutes * 60_000);
}

export function formatRelative(value, now = Date.now()) {
  if (!value) return "never";
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86_400), "day");
}

export function hours(minutes) {
  const value = minutes / 60;
  return `${value} hour${value === 1 ? "" : "s"}`;
}

export function penceToPounds(pence) {
  if (pence === null || pence === undefined || pence === "") return "";
  return (Number(pence) / 100).toFixed(2);
}

export function poundsToPence(pounds) {
  if (pounds === "" || pounds === null || pounds === undefined) return null;
  const value = Math.round(Number(pounds) * 100);
  return Number.isFinite(value) ? value : null;
}

/** "Weekends", "Weekdays", "Every day" or "Mon, Thu". */
export function describeDays(days) {
  const sorted = [...days].sort();
  if (sorted.length === 7) return "Every day";
  if (sorted.join() === "0,1,2,3,4") return "Weekdays";
  if (sorted.join() === "5,6") return "Weekends";
  return sorted.map((day) => DAYS[day]).join(", ");
}

export function slotIdentity(slot) {
  return `${slot.sport}:${slot.activity_id}:${slot.bookable_item_id}:${slot.start_time_utc}`;
}
