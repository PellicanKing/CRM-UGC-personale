import { aiConfigured } from "@/lib/ai";
import { getLeadSearches, getLeads } from "@/lib/queries";
import LeadTable from "./LeadTable";
import SearchForm from "./SearchForm";

export const dynamic = "force-dynamic";

export default function LeadsPage() {
  const searches = getLeadSearches();
  const leads = getLeads();
  const running = searches.some((s) => s.status === "running");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Lista</h1>
        <p className="text-sm text-stone-500">
          Scrivi alcune aziende a cui vorresti scrivere: l&apos;AI le cerca sul web e aggiunge aziende simili, con sito, email e profili social.
        </p>
      </div>
      <SearchForm aiEnabled={aiConfigured()} />

      {searches.length > 0 && (
        <div className="card divide-y divide-stone-100 text-sm">
          {searches.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span className="min-w-0 flex-1 truncate text-stone-700">
                {s.seeds.split("\n").filter(Boolean).slice(0, 4).join(", ")}
                {s.notes && <span className="text-stone-400"> · {s.notes}</span>}
              </span>
              {s.status === "running" && <span className="text-amber-700">Ricerca in corso… (qualche minuto)</span>}
              {s.status === "done" && <span className="text-emerald-700">{s.found} aziende trovate</span>}
              {s.status === "error" && <span className="text-rose-700">Errore: {s.error}</span>}
            </div>
          ))}
        </div>
      )}

      <LeadTable
        running={running}
        leads={leads.map(({ company: c, contact }) => ({
          id: c.id,
          name: c.name,
          origin: c.origin,
          sector: c.sector,
          city: c.city,
          reason: c.leadReason,
          website: c.website,
          instagram: c.instagram,
          tiktok: c.tiktok,
          facebook: c.facebookPage,
          email: contact?.email ?? "",
        }))}
      />
    </div>
  );
}
