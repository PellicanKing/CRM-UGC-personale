"use client";

import { useState, useTransition } from "react";
import { discardCompany, replanQueue, rescheduleMessage, setSendingEnabled } from "../actions";

export function QueueControls({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          className="btn"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await replanQueue();
              setMsg(r.ok ? (r.detail ?? "Fatto") : r.error);
            })
          }
        >
          Ricalcola orari
        </button>
        <button
          className={`btn ${enabled ? "btn-danger" : "btn-primary"}`}
          disabled={pending}
          onClick={() => {
            if (!enabled && !confirm("Attivare gli invii? Partiranno solo i messaggi che hai approvato, agli orari in coda.")) return;
            start(async () => {
              const r = await setSendingEnabled(!enabled);
              setMsg(r.ok ? null : r.error);
            });
          }}
        >
          {enabled ? "Metti in pausa" : "Attiva invii"}
        </button>
      </div>
      {msg && <span className="text-xs text-stone-500">{msg}</span>}
    </div>
  );
}

export function RowControls({ id, companyId, local }: { id: number; companyId: number; local: string }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(local);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <span className="flex items-center gap-2">
        <input type="datetime-local" className="input !w-auto" value={value} onChange={(e) => setValue(e.target.value)} />
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await rescheduleMessage(id, value);
              if (r.ok) setEditing(false);
              else setError(r.error);
            })
          }
        >
          Salva
        </button>
        <button className="btn" onClick={() => setEditing(false)}>Annulla</button>
        {error && <span className="text-xs text-rose-700">{error}</span>}
      </span>
    );
  }
  return (
    <span className="flex gap-3 text-xs">
      <button className="text-stone-600 hover:text-stone-900 hover:underline" onClick={() => setEditing(true)}>
        Sposta
      </button>
      <button
        className="text-rose-700 hover:underline"
        disabled={pending}
        onClick={() => {
          if (confirm("Fermare l'intera sequenza per questa azienda?")) start(async () => void (await discardCompany(companyId)));
        }}
      >
        Ferma sequenza
      </button>
    </span>
  );
}
