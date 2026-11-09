import { DateTime } from "luxon";
import { providerName } from "@/lib/email/config";
import { stepLabel } from "@/lib/links";
import { getQueue, getSettings } from "@/lib/queries";
import { schedulerStatus } from "@/lib/scheduler/runner";
import { QueueControls, RowControls } from "./QueueControls";

export const dynamic = "force-dynamic";

const DAYS = ["", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];

export default function ScheduledPage() {
  const s = getSettings();
  const { scheduled, waiting, sent } = getQueue();
  const status = schedulerStatus();
  const tz = s.timezone;
  const fmt = (iso: string) => DateTime.fromISO(iso, { zone: "utc" }).setZone(tz);

  // Group scheduled sends by local day
  const groups = new Map<string, typeof scheduled>();
  for (const m of scheduled) {
    const key = fmt(m.scheduledAt!).toISODate()!;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Programmati</h1>
          <p className="text-sm text-stone-500">
            Invio: {s.sendDays.map((d) => DAYS[d]).join(", ")} dalle {s.windowStart} (entro le {s.windowEnd}) · pausa casuale{" "}
            {s.minIntervalMin}–{s.maxIntervalMin} min · max {s.dailyLimit}/giorno · follow-up dopo {s.followupDays[0]} e{" "}
            {s.followupDays[1]} giorni · fuso {tz}
          </p>
        </div>
        <QueueControls enabled={s.sendingEnabled} />
      </div>

      <div className="card space-y-1 p-4 text-sm">
        <div>
          Stato invii:{" "}
          {s.sendingEnabled ? (
            <span className="font-medium text-emerald-700">attivi</span>
          ) : (
            <span className="font-medium text-amber-700">in pausa: niente viene inviato finché non li attivi</span>
          )}
          {providerName() === "console" && <span className="text-stone-500"> · provider di prova (console): nessuna email reale</span>}
        </div>
        <div className="text-stone-500">
          Pianificatore: {status.running ? "in esecuzione" : "non avviato"}
          {status.lastTick && ` · ultimo controllo ${fmt(status.lastTick).toFormat("HH:mm:ss")}`}
          {status.lastInboxCheck && ` · posta letta alle ${fmt(status.lastInboxCheck).toFormat("HH:mm")}`}
        </div>
        {status.lastError && <div className="text-rose-700">Ultimo errore: {status.lastError}</div>}
        <p className="text-xs text-stone-500">Il CRM invia solo mentre è aperto (e, con Proton, mentre il Bridge è attivo). Un invio saltato di oltre 20 minuti viene spostato al prossimo giorno utile.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">In coda ({scheduled.length})</h2>
        {scheduled.length === 0 && <p className="text-sm text-stone-500">Nessun invio programmato. Approva delle aziende in Revisione.</p>}
        {[...groups.entries()].map(([day, rows]) => (
          <div key={day} className="card overflow-hidden">
            <div className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium first-letter:uppercase">
              {fmt(rows[0].scheduledAt!).setLocale("it").toFormat("cccc d LLLL yyyy")} · {rows.length} invii
            </div>
            <ul className="divide-y divide-stone-100">
              {rows.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
                  <span className="w-20 font-mono tabular-nums">{fmt(m.scheduledAt!).toFormat("HH:mm:ss")}</span>
                  <span className="min-w-48 flex-1">
                    <span className="font-medium">{m.companyName}</span>
                    <span className="text-stone-500"> · {stepLabel(m.step)} · {m.email}</span>
                    {m.manualSchedule && <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">spostato a mano</span>}
                  </span>
                  <RowControls id={m.id} companyId={m.companyId} local={fmt(m.scheduledAt!).toFormat("yyyy-LL-dd'T'HH:mm")} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {waiting.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">In attesa ({waiting.length})</h2>
          <div className="card divide-y divide-stone-100 text-sm">
            {waiting.map((m) => (
              <div key={m.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span>
                  <span className="font-medium">{m.companyName}</span>
                  <span className="text-stone-500"> · {stepLabel(m.step)}</span>
                </span>
                <span className="text-stone-500">
                  {m.step === 0
                    ? "nessuno slot disponibile nei prossimi giorni"
                    : `parte ${s.followupDays[m.step - 1]} giorni dopo il messaggio precedente, se non risponde`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Inviati di recente</h2>
        {sent.length === 0 ? (
          <p className="text-sm text-stone-500">Ancora nessun invio.</p>
        ) : (
          <div className="card divide-y divide-stone-100 text-sm">
            {sent.map((m) => (
              <div key={m.id} className="flex flex-wrap gap-x-4 px-4 py-2">
                <span className="w-36 font-mono tabular-nums text-stone-500">{fmt(m.sentAt!).toFormat("dd/LL HH:mm:ss")}</span>
                <span className="font-medium">{m.companyName}</span>
                <span className="text-stone-500">{stepLabel(m.step)} · {m.email}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
