// Blocks commits during Swiss working hours: Mon-Fri 08:00-18:00 Europe/Zurich,
// except on Swiss public holidays and your own days off (`.days-off`, gitignored).
// Commit times stay real; this only decides when a commit may happen.
import { existsSync, readFileSync } from "node:fs";

const TZ = "Europe/Zurich";

export function zurichParts(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    year: Number(parts.year),
    weekday: parts.weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// Anonymous Gregorian algorithm.
function easter(year) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100;
  const d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}

// Holidays observed in most cantons (federal day + common cantonal ones).
export function swissHolidays(year) {
  const day = 86_400_000;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const e = easter(year);
  return new Set([
    `${year}-01-01`, // New Year
    `${year}-01-02`, // Berchtold's Day
    iso(e - 2 * day), // Good Friday
    iso(e + 1 * day), // Easter Monday
    iso(e + 39 * day), // Ascension
    iso(e + 50 * day), // Whit Monday
    `${year}-08-01`, // National Day
    `${year}-12-25`, // Christmas
    `${year}-12-26`, // St Stephen's Day
  ]);
}

/** Dates (YYYY-MM-DD) from a `.days-off` file: one per line, `#` starts a comment. */
export function parseDaysOff(text) {
  return new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.replace(/#.*/, "").trim())
      .filter((line) => /^\d{4}-\d{2}-\d{2}$/.test(line)),
  );
}

export function isWorkingTime(date, daysOff = new Set()) {
  const p = zurichParts(date);
  if (p.weekday === "Sat" || p.weekday === "Sun") return false;
  if (swissHolidays(p.year).has(p.ymd) || daysOff.has(p.ymd)) return false;
  return p.minutes >= 8 * 60 && p.minutes < 18 * 60;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const now = new Date();
  const file = new URL("../.days-off", import.meta.url);
  const daysOff = existsSync(file)
    ? parseDaysOff(readFileSync(file, "utf8"))
    : new Set();
  if (isWorkingTime(now, daysOff)) {
    const p = zurichParts(now);
    console.error(
      `commit blocked: ${p.weekday} ${p.ymd} is Swiss working time (Mon-Fri 08:00-18:00 Europe/Zurich). Commit after 18:00, or add the date to .days-off.`,
    );
    process.exit(1);
  }
}
