import { and, asc, desc, eq, isNotNull, lte } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, schema } from "@/db";
import { imapConfig, providerName } from "@/lib/email/config";
import { checkInbox } from "@/lib/email/inbox";
import { sendMessage } from "@/lib/email/send";
import { getSettings } from "@/lib/queries";
import { planSchedule, unschedule } from "./plan";

const TICK_MS = 10_000;
const INBOX_EVERY_MS = 5 * 60_000;
// A send this late (app closed, Bridge down...) is re-planned instead of going out at an odd hour
const MAX_LATENESS_MS = 20 * 60_000;

export type SchedulerStatus = {
  running: boolean;
  lastTick: string | null;
  lastInboxCheck: string | null;
  lastError: string | null;
};

const g = globalThis as unknown as { __scheduler?: { timer: NodeJS.Timeout; busy: boolean; status: SchedulerStatus } };

export function schedulerStatus(): SchedulerStatus {
  return g.__scheduler?.status ?? { running: false, lastTick: null, lastInboxCheck: null, lastError: null };
}

async function maybeCheckInbox(status: SchedulerStatus, force = false) {
  if (providerName() !== "proton" || !imapConfig()) return;
  const last = status.lastInboxCheck ? Date.parse(status.lastInboxCheck) : 0;
  if (!force && Date.now() - last < INBOX_EVERY_MS) return;
  await checkInbox();
  status.lastInboxCheck = new Date().toISOString();
}

/** One scheduler step: read inbox, plan, send at most one due message. */
export async function tick(status: SchedulerStatus): Promise<void> {
  status.lastTick = new Date().toISOString();
  const settings = getSettings();
  if (!settings.sendingEnabled) {
    planSchedule(); // keep the preview up to date even while paused
    return;
  }

  await maybeCheckInbox(status);
  planSchedule();

  const now = DateTime.utc();
  const due = db
    .select()
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.status, "scheduled"),
        isNotNull(schema.messages.scheduledAt),
        lte(schema.messages.scheduledAt, now.toISO()),
      ),
    )
    .orderBy(asc(schema.messages.scheduledAt))
    .all();
  if (due.length === 0) return;

  const late = due.filter((m) => now.toMillis() - Date.parse(m.scheduledAt!) > MAX_LATENESS_MS);
  if (late.length) {
    unschedule({ includeManual: true, onlyIds: late.map((m) => m.id) });
    planSchedule();
    return;
  }

  // Keep at least the minimum gap from the last real send (ticks and retries can drift)
  const lastSent = db
    .select({ sentAt: schema.messages.sentAt })
    .from(schema.messages)
    .where(isNotNull(schema.messages.sentAt))
    .orderBy(desc(schema.messages.sentAt))
    .get();
  if (lastSent?.sentAt) {
    const elapsed = now.toMillis() - Date.parse(lastSent.sentAt);
    if (elapsed < settings.minIntervalMin * 60_000) {
      const span = (settings.maxIntervalMin - settings.minIntervalMin) * 60_000;
      const next = Date.parse(lastSent.sentAt) + settings.minIntervalMin * 60_000 + Math.round(Math.random() * span);
      db.update(schema.messages)
        .set({ scheduledAt: new Date(next).toISOString() })
        .where(eq(schema.messages.id, due[0].id))
        .run();
      return;
    }
  }

  // Last-second check for replies before writing again to the same company
  await maybeCheckInbox(status, due[0].step > 0);
  await sendMessage(due[0].id);
  // Re-plan so the following sends keep a random gap from this real send time
  planSchedule();
}

export function startScheduler() {
  if (g.__scheduler || process.env.SCHEDULER_DISABLED === "1") return;
  const state = {
    busy: false,
    status: { running: true, lastTick: null, lastInboxCheck: null, lastError: null } as SchedulerStatus,
    timer: setInterval(async () => {
      if (state.busy) return;
      state.busy = true;
      try {
        await tick(state.status);
        state.status.lastError = null;
      } catch (e) {
        state.status.lastError = `${new Date().toLocaleString("it-IT")}: ${e instanceof Error ? e.message : String(e)}`;
        console.error("[scheduler]", e);
      } finally {
        state.busy = false;
      }
    }, TICK_MS),
  };
  g.__scheduler = state;
  console.log("[scheduler] avviato");
}
