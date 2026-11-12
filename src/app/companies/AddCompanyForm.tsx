"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCompany, type ActionResult } from "../actions";

const fields: { name: string; label: string; placeholder?: string; type?: string }[] = [
  { name: "name", label: "Nome *" },
  { name: "website", label: "Sito", placeholder: "https://" },
  { name: "sector", label: "Settore" },
  { name: "city", label: "Città" },
  { name: "instagram", label: "Instagram (URL profilo)" },
  { name: "tiktok", label: "TikTok (URL profilo)" },
  { name: "facebookPage", label: "Pagina Facebook (URL)" },
  { name: "contactName", label: "Nome contatto" },
  { name: "contactRole", label: "Ruolo" },
  { name: "email", label: "Email", type: "email" },
];

export default function AddCompanyForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addCompany, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium">+ Aggiungi azienda manualmente</summary>
      <form ref={formRef} action={action} className="mt-4 grid gap-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="label" htmlFor={f.name}>{f.label}</label>
            <input id={f.name} name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} className="input" required={f.name === "name"} />
          </div>
        ))}
        <div className="flex items-center gap-3 sm:col-span-3">
          <button className="btn btn-primary" disabled={pending}>{pending ? "Salvataggio…" : "Aggiungi"}</button>
          {state && !state.ok && <span className="text-sm text-rose-700">{state.error}</span>}
          {state?.ok && <span className="text-sm text-emerald-700">Aggiunta: la trovi in Revisione.</span>}
        </div>
      </form>
    </details>
  );
}
