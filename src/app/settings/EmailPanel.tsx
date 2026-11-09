"use client";

import { useState, useTransition } from "react";
import { runInboxCheck, sendTestEmail, testEmailConnection } from "../actions";

type Props = { provider: string; from: string | null; smtpHost: string | null; imapReady: boolean };

export default function EmailPanel({ provider, from, smtpHost, imapReady }: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; detail?: string }>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.detail ?? okText } : { ok: false, text: r.error ?? "Errore" });
    });

  return (
    <section className="card max-w-3xl space-y-3 p-5">
      <h2 className="text-sm font-medium">Email · Proton Mail</h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-stone-500">Provider</dt>
        <dd>{provider === "proton" ? "Proton Mail (SMTP)" : <span className="text-amber-700">Prova (console): nessun invio reale</span>}</dd>
        <dt className="text-stone-500">Mittente</dt>
        <dd>{from ?? <span className="text-rose-700">non configurato</span>}</dd>
        <dt className="text-stone-500">Server invio</dt>
        <dd>{smtpHost ?? <span className="text-rose-700">non configurato</span>}</dd>
        <dt className="text-stone-500">Rilevamento risposte</dt>
        <dd>{imapReady ? "attivo (IMAP via Bridge)" : <span className="text-amber-700">IMAP non configurato</span>}</dd>
      </dl>
      <p className="text-xs text-stone-500">La configurazione si modifica in <code>.env.local</code> (vedi <code>.env.example</code>). Con Bridge, l&apos;app Proton Mail Bridge deve essere aperta.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" disabled={pending} onClick={() => run(testEmailConnection, "Connessione OK")}>Prova connessione</button>
        <button className="btn" disabled={pending} onClick={() => run(sendTestEmail, "Email di prova inviata al tuo indirizzo")}>Invia prova a me stesso</button>
        <button className="btn" disabled={pending || !imapReady} onClick={() => run(runInboxCheck, "Controllo completato")}>Controlla risposte</button>
        {pending && <span className="text-sm text-stone-500">…</span>}
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}
    </section>
  );
}
