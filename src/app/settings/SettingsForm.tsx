"use client";

import { useActionState } from "react";
import type { Settings } from "@/db/schema";
import { updateSettings, type ActionResult } from "../actions";

const days = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export default function SettingsForm({ settings: s }: { settings: Settings }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateSettings, null);
  return (
    <form action={action} className="card max-w-3xl space-y-6 p-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Finestra di invio</legend>
        <div className="flex flex-wrap gap-2">
          {days.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1 text-sm has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50">
              <input type="checkbox" name="sendDays" value={i + 1} defaultChecked={s.sendDays.includes(i + 1)} className="accent-emerald-700" />
              {d}
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Dalle</label><input className="input" type="time" name="windowStart" defaultValue={s.windowStart} /></div>
          <div><label className="label">Alle</label><input className="input" type="time" name="windowEnd" defaultValue={s.windowEnd} /></div>
          <div>
            <label className="label">Fuso predefinito destinatario</label>
            <input className="input" name="timezone" defaultValue={s.timezone} />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">Ritmo</legend>
        <div><label className="label">Limite giornaliero</label><input className="input" type="number" min={1} name="dailyLimit" defaultValue={s.dailyLimit} /></div>
        <div><label className="label">Intervallo min (minuti)</label><input className="input" type="number" min={1} name="minIntervalMin" defaultValue={s.minIntervalMin} /></div>
        <div><label className="label">Intervallo max (minuti)</label><input className="input" type="number" min={1} name="maxIntervalMin" defaultValue={s.maxIntervalMin} /></div>
        <div><label className="label">Follow-up 1 dopo (giorni)</label><input className="input" type="number" min={1} name="followup1" defaultValue={s.followupDays[0] ?? 3} /></div>
        <div><label className="label">Follow-up 2 dopo (giorni)</label><input className="input" type="number" min={1} name="followup2" defaultValue={s.followupDays[1] ?? 7} /></div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Firma e disiscrizione</legend>
        <div><label className="label">Firma</label><textarea className="input min-h-20" name="signature" defaultValue={s.signature} /></div>
        <div>
          <label className="label">Riga di disiscrizione (aggiunta a ogni email, obbligatoria)</label>
          <textarea className="input min-h-16" name="unsubscribeText" defaultValue={s.unsubscribeText} required />
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Salvataggio…" : "Salva"}</button>
        {state && !state.ok && <span className="text-sm text-rose-700">{state.error}</span>}
        {state?.ok && <span className="text-sm text-emerald-700">Salvato ✓</span>}
      </div>
    </form>
  );
}
