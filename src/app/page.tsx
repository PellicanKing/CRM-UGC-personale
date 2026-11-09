import Link from "next/link";
import { COMPANY_STATUSES } from "@/db/schema";
import { aiConfigured } from "@/lib/ai";
import { statusCounts } from "@/lib/queries";
import { statusLabels } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default function Home() {
  const counts = statusCounts();
  const toReview = (counts.review ?? 0) + (counts.new ?? 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Panoramica</h1>
          <p className="text-sm text-stone-500">Nulla viene inviato senza la tua approvazione esplicita.</p>
        </div>
        <Link href="/review" className="btn btn-primary">
          Inizia revisione ({toReview})
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {COMPANY_STATUSES.map((s) => (
          <div key={s} className="card p-4">
            <div className="text-xs text-stone-500">{statusLabels[s]}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{counts[s] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="card p-5 text-sm">
        <h2 className="mb-2 font-medium">Stato del sistema</h2>
        <ul className="space-y-1 text-stone-600">
          <li>AI (Claude): {aiConfigured() ? <span className="text-emerald-700">configurata</span> : <span className="text-amber-700">manca ANTHROPIC_API_KEY in .env.local</span>}</li>
          <li>Invio email: <span className="text-stone-500">{process.env.EMAIL_PROVIDER === "proton" ? "Proton Mail" : "modalità prova (console)"} · programmazione non ancora attiva</span></li>
        </ul>
      </div>
    </div>
  );
}
