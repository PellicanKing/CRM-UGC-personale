"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { discardLeads, startWriting, updateLeadEmail } from "../actions";

type Lead = {
  id: number;
  name: string;
  origin: string | null;
  sector: string | null;
  city: string | null;
  reason: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  email: string;
};

export default function LeadTable({ leads, running }: { leads: Lead[]; running: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // New leads are selected by default
  const ids = leads.map((l) => l.id).join(",");
  useEffect(() => {
    setSelected((prev) => new Set([...prev, ...leads.map((l) => l.id)].filter((id) => leads.some((l) => l.id === id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  // Refresh while a search is running
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [running, router]);

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const chosen = [...selected];
  const noEmail = leads.filter((l) => selected.has(l.id) && !l.email).length;

  if (leads.length === 0) {
    return <p className="text-sm text-stone-500">{running ? "La lista si sta creando…" : "La lista è vuota."}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 text-xs text-stone-500">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  className="accent-emerald-700"
                  checked={selected.size === leads.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(leads.map((l) => l.id)) : new Set())}
                />
              </th>
              <th className="px-3 py-2 font-medium">Azienda</th>
              <th className="px-3 py-2 font-medium">Perché</th>
              <th className="px-3 py-2 font-medium">Link</th>
              <th className="px-3 py-2 font-medium">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {leads.map((l) => (
              <tr key={l.id} className={selected.has(l.id) ? "" : "opacity-50"}>
                <td className="px-3 py-2.5 align-top">
                  <input type="checkbox" className="accent-emerald-700" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-stone-500">{[l.sector, l.city].filter(Boolean).join(" · ")}</div>
                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] ${l.origin === "ai" ? "bg-violet-50 text-violet-700" : "bg-stone-100 text-stone-600"}`}>
                    {l.origin === "ai" ? "trovata dall'AI" : "indicata da te"}
                  </span>
                </td>
                <td className="max-w-sm px-3 py-2.5 align-top text-stone-600">{l.reason}</td>
                <td className="px-3 py-2.5 align-top">
                  <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
                    {l.website && <A href={l.website}>Sito</A>}
                    {l.instagram && <A href={l.instagram}>Instagram</A>}
                    {l.tiktok && <A href={l.tiktok}>TikTok</A>}
                    {l.facebook && <A href={l.facebook}>Facebook</A>}
                  </div>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <input
                    className={`input !w-56 ${l.email ? "" : "border-amber-400"}`}
                    defaultValue={l.email}
                    placeholder="email mancante"
                    onBlur={(e) => {
                      if (e.target.value.trim() === l.email) return;
                      start(async () => {
                        const r = await updateLeadEmail(l.id, e.target.value);
                        if (r.ok) router.refresh();
                        else setError(r.error);
                      });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card sticky bottom-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="text-sm">
          {error ? (
            <span className="text-rose-700">{error}</span>
          ) : (
            <span className="text-stone-600">
              {chosen.length} selezionate
              {noEmail > 0 && <span className="text-amber-700"> · {noEmail} senza email (aggiungila o non potrai inviare)</span>}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-danger"
            disabled={pending || chosen.length === 0}
            onClick={() => start(async () => void (await discardLeads(chosen)))}
          >
            Scarta selezionate
          </button>
          <button
            className="btn btn-primary"
            disabled={pending || chosen.length === 0}
            onClick={() =>
              start(async () => {
                const r = await startWriting(chosen);
                if (r.ok) router.push("/review");
                else setError(r.error);
              })
            }
          >
            Passa alla scrittura ({chosen.length}) →
          </button>
        </div>
      </div>
    </div>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
      {children} ↗
    </a>
  );
}
