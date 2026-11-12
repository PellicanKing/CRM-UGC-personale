"use client";

import { useActionState, useEffect, useRef } from "react";
import { createLeadSearch, type ActionResult } from "../actions";

export default function SearchForm({ aiEnabled }: { aiEnabled: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createLeadSearch, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="card grid gap-3 p-5 sm:grid-cols-[2fr_1fr]">
      <div className="sm:row-span-3">
        <label className="label" htmlFor="seeds">Aziende di partenza (una per riga: nome, sito o profilo Instagram/TikTok)</label>
        <textarea id="seeds" name="seeds" required className="input min-h-36" placeholder={"Nome brand 1\nhttps://www.brand2.it\nhttps://www.instagram.com/brand3"} />
      </div>
      <div>
        <label className="label" htmlFor="notes">Cosa cerchi (facoltativo)</label>
        <input id="notes" name="notes" className="input" placeholder="es. brand skincare italiani che fanno ads" />
      </div>
      <div>
        <label className="label" htmlFor="count">Quante aziende simili trovare</label>
        <input id="count" name="count" type="number" min={1} max={30} defaultValue={10} className="input" />
      </div>
      <div className="flex flex-col justify-end gap-1">
        <button className="btn btn-primary justify-center" disabled={pending || !aiEnabled}>
          {pending ? "Avvio…" : "Crea la lista"}
        </button>
        {!aiEnabled && <span className="text-xs text-amber-700">Serve l&apos;AI: aggiungi la chiave con CONFIGURA.</span>}
        {state && !state.ok && <span className="text-xs text-rose-700">{state.error}</span>}
        {state?.ok && <span className="text-xs text-emerald-700">Ricerca avviata: i risultati compaiono qui sotto.</span>}
      </div>
    </form>
  );
}
