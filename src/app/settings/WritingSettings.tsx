"use client";

import { useActionState, useState, useTransition } from "react";
import { learnStyleNow, resetTemplates, updateWriting, type ActionResult } from "../actions";

const labels = ["Primo messaggio", "Follow-up 1", "Follow-up 2"];

type Props = { templates: string[]; learnedStyle: string; pendingEdits: number; aiEnabled: boolean };

export default function WritingSettings({ templates, learnedStyle, pendingEdits, aiEnabled }: Props) {
  const [state, action, saving] = useActionState<ActionResult | null, FormData>(updateWriting, null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form action={action} className="card max-w-3xl space-y-6 p-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Template delle email</legend>
        <p className="text-xs text-stone-500">
          Segnaposto: <code>{"{{nome}}"}</code> nome del contatto, <code>{"{{azienda}}"}</code> nome dell&apos;azienda,{" "}
          <code>{"{{personalizzazione}}"}</code> la parte scritta dall&apos;AI per quell&apos;azienda.
          Se lasci un template vuoto, l&apos;AI scrive tutta l&apos;email. Firma e riga di disiscrizione si aggiungono da sole.
        </p>
        {labels.map((l, i) => (
          <div key={l}>
            <label className="label" htmlFor={`template${i}`}>{l}</label>
            <textarea id={`template${i}`} name={`template${i}`} className="input min-h-32 font-mono text-[13px]" defaultValue={templates[i]} />
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Il tuo stile (imparato dalle tue correzioni)</legend>
        <p className="text-xs text-stone-500">
          Ogni 3 email che correggi e approvi, l&apos;AI rilegge le differenze e aggiorna queste note. Puoi anche modificarle a mano.
          {pendingEdits > 0 && ` Correzioni non ancora imparate: ${pendingEdits}.`}
        </p>
        <textarea name="learnedStyle" className="input min-h-40" defaultValue={learnedStyle} placeholder="Ancora vuoto: si riempie da solo dopo le prime correzioni." />
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</button>
        <button
          type="button"
          className="btn"
          disabled={pending || !aiEnabled || pendingEdits === 0}
          onClick={() => start(async () => { const r = await learnStyleNow(); setMsg(r.ok ? (r.detail ?? "Fatto") : r.error); })}
        >
          {pending ? "Sto imparando…" : "Impara ora dalle correzioni"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => { if (confirm("Ripristinare i template predefiniti?")) start(async () => { await resetTemplates(); setMsg("Template ripristinati: ricarica la pagina"); }); }}
        >
          Template predefiniti
        </button>
        {state && !state.ok && <span className="text-sm text-rose-700">{state.error}</span>}
        {state?.ok && <span className="text-sm text-emerald-700">Salvato ✓</span>}
        {msg && <span className="text-sm text-stone-600">{msg}</span>}
      </div>
    </form>
  );
}
