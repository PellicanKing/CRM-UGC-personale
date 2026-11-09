"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ReviewItem } from "@/lib/queries";
import { adLibraryUrl, stepLabel } from "@/lib/links";
import { StatusBadge } from "@/components/StatusBadge";
import {
  approveCompany,
  discardCompany,
  enrichAndGenerate,
  regenerateMessage,
  saveDrafts,
} from "../actions";

type Draft = { subject: string; text: string };

type Props = {
  items: ReviewItem[];
  signature: string;
  unsubscribeText: string;
  aiEnabled: boolean;
};

function isTyping(el: Element | null) {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

export default function ReviewDeck({ items, signature, unsubscribeText, aiEnabled }: Props) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const queue = useMemo(() => items.filter((i) => !done.has(i.company.id)), [items, done]);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const safeIndex = Math.min(index, Math.max(queue.length - 1, 0));
  const item = queue[safeIndex];
  const msgs = useMemo(() => item?.messages ?? [], [item]);
  const current = msgs.find((m) => m.step === step) ?? msgs[0];

  const draftOf = useCallback(
    (m: { id: number; subject: string | null; finalText: string | null }): Draft =>
      drafts[m.id] ?? { subject: m.subject ?? "", text: m.finalText ?? "" },
    [drafts],
  );

  const dirtyEdits = useMemo(
    () =>
      msgs
        .filter((m) => {
          const d = drafts[m.id];
          return d && (d.subject !== (m.subject ?? "") || d.text !== (m.finalText ?? ""));
        })
        .map((m) => ({ id: m.id, ...drafts[m.id] })),
    [msgs, drafts],
  );

  // Reset per-card UI state when the card changes
  useEffect(() => {
    setStep(0);
    setInstruction("");
    setError(null);
  }, [item?.company.id]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const run = useCallback(
    (fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void, okNotice?: string) => {
      setError(null);
      startTransition(async () => {
        const res = await fn();
        if (res.ok) {
          onOk?.();
          if (okNotice) setNotice(okNotice);
        } else setError(res.error ?? "Errore");
      });
    },
    [],
  );

  const go = useCallback(
    (delta: number) => {
      if (!item) return;
      // Auto-save edits when leaving a card
      if (dirtyEdits.length) {
        const id = item.company.id;
        const edits = dirtyEdits;
        startTransition(async () => {
          await saveDrafts(id, edits);
        });
      }
      setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(queue.length - 1, 0)));
    },
    [item, dirtyEdits, queue.length],
  );

  const approve = useCallback(() => {
    if (!item || pending || msgs.length === 0) return;
    const id = item.company.id;
    run(() => approveCompany(id, dirtyEdits), () => setDone((s) => new Set(s).add(id)), "Approvata ✓ (nessun invio: andrà programmata)");
  }, [item, pending, msgs.length, dirtyEdits, run]);

  const discard = useCallback(() => {
    if (!item || pending) return;
    const id = item.company.id;
    run(() => discardCompany(id), () => setDone((s) => new Set(s).add(id)), "Scartata");
  }, [item, pending, run]);

  const regenerate = useCallback(() => {
    if (!item || pending) return;
    if (!aiEnabled) return setError("Configura ANTHROPIC_API_KEY in .env.local per usare l'AI.");
    if (!current) {
      run(() => enrichAndGenerate(item.company.id, instruction || undefined), undefined, "Scheda e messaggi generati");
      return;
    }
    const msgId = current.id;
    run(
      async () => {
        const res = await regenerateMessage(msgId, instruction || undefined);
        if (res.ok && res.subject !== undefined && res.text !== undefined) {
          setDrafts((d) => ({ ...d, [msgId]: { subject: res.subject!, text: res.text! } }));
        }
        return res;
      },
      undefined,
      `${stepLabel(current.step)} rigenerato`,
    );
  }, [item, pending, aiEnabled, current, instruction, run]);

  const regenerateAll = useCallback(() => {
    if (!item || pending) return;
    if (!aiEnabled) return setError("Configura ANTHROPIC_API_KEY in .env.local per usare l'AI.");
    const id = item.company.id;
    run(
      () => enrichAndGenerate(id, instruction || undefined),
      () => setDrafts({}),
      "Scheda e sequenza rigenerate",
    );
  }, [item, pending, aiEnabled, instruction, run]);

  const edit = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = isTyping(document.activeElement);
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur();
        setShowHelp(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        approve();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const handlers: Record<string, () => void> = {
        arrowright: () => go(1),
        j: () => go(1),
        arrowleft: () => go(-1),
        k: () => go(-1),
        a: approve,
        e: edit,
        r: regenerate,
        g: regenerateAll,
        d: discard,
        x: discard,
        "1": () => setStep(0),
        "2": () => setStep(1),
        "3": () => setStep(2),
        "?": () => setShowHelp((s) => !s),
      };
      const h = handlers[k];
      if (h) {
        e.preventDefault();
        h();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, approve, edit, regenerate, regenerateAll, discard]);

  if (!item) {
    return (
      <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
        <h1 className="text-lg font-semibold">Nessuna azienda da revisionare</h1>
        <p className="mt-2 text-sm text-stone-600">
          Aggiungi aziende dalla pagina <Link className="text-emerald-700 underline" href="/companies">Aziende</Link>.
        </p>
      </div>
    );
  }

  const { company, contact } = item;
  const draft = current ? draftOf(current) : null;
  const adLib = company.adLibraryUrl ?? adLibraryUrl(company.name, company.facebookPage);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Revisione</h1>
          <span className="text-sm text-stone-500">
            {safeIndex + 1} / {queue.length}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <button className="btn" onClick={() => go(-1)} disabled={safeIndex === 0}>← Prec.</button>
          <button className="btn" onClick={() => go(1)} disabled={safeIndex >= queue.length - 1}>Succ. →</button>
          <button className="btn" onClick={() => setShowHelp((s) => !s)}>Scorciatoie <kbd>?</kbd></button>
        </div>
      </div>

      {showHelp && (
        <div className="card grid grid-cols-2 gap-x-6 gap-y-1.5 p-4 text-sm sm:grid-cols-4">
          <span><kbd>A</kbd> / <kbd>Ctrl</kbd>+<kbd>Invio</kbd> Approva</span>
          <span><kbd>E</kbd> Modifica</span>
          <span><kbd>R</kbd> Rigenera step</span>
          <span><kbd>G</kbd> Rigenera tutto</span>
          <span><kbd>D</kbd> / <kbd>X</kbd> Scarta</span>
          <span><kbd>←</kbd><kbd>→</kbd> / <kbd>K</kbd><kbd>J</kbd> Naviga</span>
          <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Cambia step</span>
          <span><kbd>Esc</kbd> Esci dal testo</span>
        </div>
      )}

      {!aiEnabled && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          AI non configurata: aggiungi <code>ANTHROPIC_API_KEY</code> in <code>.env.local</code> per generare e rigenerare i messaggi.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Company sheet */}
        <section className="card space-y-4 p-5">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold leading-tight">{company.name}</h2>
              <StatusBadge status={company.status} />
            </div>
            <p className="mt-0.5 text-sm text-stone-500">
              {[company.sector, company.city].filter(Boolean).join(" · ")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            {company.website && <ExtLink href={company.website}>Sito</ExtLink>}
            {company.instagram ? <ExtLink href={company.instagram}>Instagram</ExtLink> : <Missing>Instagram</Missing>}
            {company.facebookPage ? <ExtLink href={company.facebookPage}>Facebook</ExtLink> : <Missing>Facebook</Missing>}
            <ExtLink href={adLib}>Ad Library</ExtLink>
          </div>

          <div className="rounded-lg bg-stone-50 p-3 text-sm">
            {contact ? (
              <>
                <div className="font-medium">
                  {contact.name ?? "Contatto"} {contact.role && <span className="font-normal text-stone-500">· {contact.role}</span>}
                </div>
                <div className="text-stone-600">
                  {contact.email ?? <span className="text-rose-600">email mancante</span>}
                  {contact.email && (
                    <span className={`ml-2 text-xs ${contact.emailVerified ? "text-emerald-700" : "text-stone-400"}`}>
                      {contact.emailVerified ? "verificata" : "non verificata"}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span className="text-rose-600">Nessun contatto</span>
            )}
          </div>

          <Field label="Cosa fanno" value={company.summary} />
          <Field label="Target" value={company.target} />
          <Field label="Punti deboli" value={company.weaknesses} />
          <Field label="Aggancio" value={company.hook} highlight />

          {company.dmText && (
            <div>
              <div className="label flex items-center justify-between">
                <span>DM Instagram (da copiare, invio manuale)</span>
                <CopyButton text={company.dmText} />
              </div>
              <p className="whitespace-pre-wrap rounded-lg border border-dashed border-stone-300 p-3 text-sm text-stone-700">{company.dmText}</p>
            </div>
          )}
        </section>

        {/* Messages */}
        <section className="card flex flex-col p-5">
          {msgs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="text-sm text-stone-600">Questa azienda non ha ancora scheda né messaggi.</p>
              <button className="btn btn-primary" onClick={regenerateAll} disabled={pending || !aiEnabled}>
                {pending ? "Generazione in corso…" : "Genera scheda e messaggi"} <kbd className="!border-emerald-500 !bg-emerald-600 !text-emerald-50">G</kbd>
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex gap-1 border-b border-stone-200">
                {msgs.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setStep(m.step)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                      current?.id === m.id ? "border-emerald-700 font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {stepLabel(m.step)}
                    {drafts[m.id] && <span className="ml-1 text-amber-600">•</span>}
                  </button>
                ))}
              </div>

              {current && draft && (
                <div className="flex flex-1 flex-col gap-3">
                  <div>
                    <label className="label" htmlFor="subject">Oggetto</label>
                    <input
                      id="subject"
                      className="input"
                      value={draft.subject}
                      onChange={(e) => setDrafts((d) => ({ ...d, [current.id]: { ...draft, subject: e.target.value } }))}
                    />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <label className="label" htmlFor="body">Messaggio</label>
                    <textarea
                      id="body"
                      ref={textareaRef}
                      className="input min-h-64 flex-1 resize-y leading-relaxed"
                      value={draft.text}
                      onChange={(e) => setDrafts((d) => ({ ...d, [current.id]: { ...draft, text: e.target.value } }))}
                    />
                    <div className="mt-1 flex justify-between text-xs text-stone-400">
                      <span>{draft.text.trim().split(/\s+/).filter(Boolean).length} parole</span>
                      {current.aiDraft && current.aiDraft !== draft.text && (
                        <button
                          className="hover:text-stone-700"
                          onClick={() => setDrafts((d) => ({ ...d, [current.id]: { ...draft, text: current.aiDraft ?? "" } }))}
                        >
                          Ripristina bozza AI
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-xs text-stone-500">
                    {signature}
                    {"\n\n—\n"}
                    {unsubscribeText}
                  </div>
                  <input
                    className="input"
                    placeholder="Indicazione per la rigenerazione (opzionale), es. «più breve», «parla delle recensioni»"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Action bar */}
      <div className="card sticky bottom-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-h-5 text-sm">
          {pending && <span className="text-stone-500">Elaborazione…</span>}
          {!pending && error && <span className="text-rose-700">{error}</span>}
          {!pending && !error && notice && <span className="text-emerald-700">{notice}</span>}
          {!pending && !error && !notice && dirtyEdits.length > 0 && <span className="text-amber-700">Modifiche non salvate (salvate all&apos;approvazione o al cambio card)</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-danger" onClick={discard} disabled={pending}>Scarta <kbd>D</kbd></button>
          <button className="btn" onClick={regenerate} disabled={pending || !aiEnabled}>Rigenera <kbd>R</kbd></button>
          <button className="btn" onClick={edit} disabled={pending || msgs.length === 0}>Modifica <kbd>E</kbd></button>
          <button className="btn btn-primary" onClick={approve} disabled={pending || msgs.length === 0}>
            Approva <kbd className="!border-emerald-500 !bg-emerald-600 !text-emerald-50">A</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-md border border-stone-200 px-2 py-1 text-stone-700 hover:border-emerald-600 hover:text-emerald-800">
      {children} ↗
    </a>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-dashed border-stone-200 px-2 py-1 text-stone-400 line-through">{children}</span>;
}

function Field({ label, value, highlight }: { label: string; value: string | null; highlight?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <p className={`text-sm leading-relaxed ${highlight ? "rounded-md bg-emerald-50 p-2 text-emerald-900" : "text-stone-700"}`}>
        {value || <span className="text-stone-400">—</span>}
      </p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="text-emerald-700 hover:underline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copiato ✓" : "Copia"}
    </button>
  );
}
