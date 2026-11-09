import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, schema } from "@/db";
import type { Message, Settings } from "@/db/schema";
import { getSettings } from "@/lib/queries";

// Small random delay before the very first email of the day (0-120 s),
// so the day doesn't always start at exactly hh:mm:00.
const FIRST_SEND_JITTER_MS = 120_000;

function randomGapMs(s: Settings): number {
  const min = s.minIntervalMin * 60_000;
  const max = s.maxIntervalMin * 60_000;
  return Math.round(min + Math.random() * (max - min));
}

function atTime(day: DateTime, hhmm: string): DateTime {
  const [h, m] = hhmm.split(":").map(Number);
  return day.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

type DayLoad = { count: number; last: DateTime | null };

/** Per-day usage (count of sends and latest send time) in the sending timezone. */
function loadDays(tz: string): Map<string, DayLoad> {
  const rows = db
    .select({ scheduledAt: schema.messages.scheduledAt, sentAt: schema.messages.sentAt, status: schema.messages.status })
    .from(schema.messages)
    .where(
      or(
        and(eq(schema.messages.status, "scheduled"), isNotNull(schema.messages.scheduledAt)),
        and(eq(schema.messages.status, "sent"), isNotNull(schema.messages.sentAt)),
      ),
    )
    .all();
  const map = new Map<string, DayLoad>();
  for (const r of rows) {
    const iso = r.status === "sent" ? r.sentAt! : r.scheduledAt!;
    const t = DateTime.fromISO(iso, { zone: "utc" }).setZone(tz);
    const key = t.toISODate()!;
    const load = map.get(key) ?? { count: 0, last: null };
    load.count++;
    if (!load.last || t > load.last) load.last = t;
    map.set(key, load);
  }
  return map;
}

/**
 * Earliest moment a message may go out, or null if it is not ready yet
 * (follow-ups wait until the previous step has actually been sent).
 */
function earliest(msg: Message, siblings: Message[], s: Settings, now: DateTime): DateTime | null {
  if (msg.step === 0) return now;
  const prev = siblings.find((m) => m.step === msg.step - 1);
  if (!prev || prev.status !== "sent" || !prev.sentAt) return null;
  const wait = s.followupDays[msg.step - 1] ?? 7;
  return DateTime.fromISO(prev.sentAt, { zone: "utc" })
    .setZone(s.timezone)
    .plus({ days: wait })
    .startOf("day");
}

/** Finds the next human-looking slot on or after `from`, honouring days, window and daily limit. */
function nextSlot(from: DateTime, now: DateTime, s: Settings, days: Map<string, DayLoad>): DateTime | null {
  let day = DateTime.max(from, now).startOf("day");
  for (let i = 0; i < 120; i++, day = day.plus({ days: 1 })) {
    if (!s.sendDays.includes(day.weekday)) continue;
    const load = days.get(day.toISODate()!) ?? { count: 0, last: null };
    if (load.count >= s.dailyLimit) continue;

    const start = atTime(day, s.windowStart);
    const end = atTime(day, s.windowEnd);
    let t: DateTime;
    if (load.last) t = load.last.plus({ milliseconds: randomGapMs(s) });
    else t = start.plus({ milliseconds: Math.round(Math.random() * FIRST_SEND_JITTER_MS) });
    // Never schedule in the past; if the window is already open, keep a natural gap from now
    if (t < now) t = now.plus({ milliseconds: load.last ? 30_000 : randomGapMs(s) });
    if (t < start || t > end) continue;
    return t.set({ millisecond: 0 });
  }
  return null;
}

/**
 * Assigns a send time to every approved message that is ready to go.
 * Only messages explicitly approved by the user are ever scheduled.
 */
export function planSchedule(nowUtc: DateTime = DateTime.utc()): number {
  const s = getSettings();
  const now = nowUtc.setZone(s.timezone);

  const pending = db
    .select({ msg: schema.messages })
    .from(schema.messages)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.messages.companyId))
    .innerJoin(schema.contacts, eq(schema.contacts.id, schema.messages.contactId))
    .where(
      and(
        eq(schema.messages.status, "approved"),
        inArray(schema.companies.status, ["approved", "contacted"]),
        isNotNull(schema.contacts.email),
      ),
    )
    .all()
    .map((r) => r.msg);
  if (pending.length === 0) return 0;

  const companyIds = [...new Set(pending.map((m) => m.companyId))];
  const all = db.select().from(schema.messages).where(inArray(schema.messages.companyId, companyIds)).all();

  const ready = pending
    .map((m) => ({ m, from: earliest(m, all.filter((x) => x.companyId === m.companyId), s, now) }))
    .filter((x): x is { m: Message; from: DateTime } => x.from !== null)
    // Follow-ups first (they are due), then first messages in approval order
    .sort((a, b) => b.m.step - a.m.step || a.from.toMillis() - b.from.toMillis() || a.m.id - b.m.id);

  const days = loadDays(s.timezone);
  let planned = 0;
  for (const { m, from } of ready) {
    const slot = nextSlot(from, now, s, days);
    if (!slot) continue;
    db.update(schema.messages)
      .set({ status: "scheduled", scheduledAt: slot.toUTC().toISO(), manualSchedule: false })
      .where(eq(schema.messages.id, m.id))
      .run();
    const key = slot.toISODate()!;
    const load = days.get(key) ?? { count: 0, last: null };
    load.count++;
    if (!load.last || slot > load.last) load.last = slot;
    days.set(key, load);
    planned++;
  }
  return planned;
}

/** Puts scheduled messages back to "approved" so the planner reassigns them. */
export function unschedule(opts: { includeManual: boolean; onlyIds?: number[] }) {
  const conds = [eq(schema.messages.status, "scheduled")];
  if (!opts.includeManual) conds.push(eq(schema.messages.manualSchedule, false));
  if (opts.onlyIds) conds.push(inArray(schema.messages.id, opts.onlyIds));
  db.update(schema.messages)
    .set({ status: "approved", scheduledAt: null, manualSchedule: false })
    .where(and(...conds))
    .run();
}

/** Recomputes the whole queue (e.g. after the settings changed). Manual moves are kept. */
export function replanAll() {
  unschedule({ includeManual: false });
  return planSchedule();
}
