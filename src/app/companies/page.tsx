import { getCompaniesWithContacts } from "@/lib/queries";
import { StatusBadge } from "@/components/StatusBadge";
import AddCompanyForm from "./AddCompanyForm";
import RowActions from "./RowActions";

export const dynamic = "force-dynamic";

export default function CompaniesPage() {
  const rows = getCompaniesWithContacts();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Aziende</h1>
      <AddCompanyForm />
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 text-xs text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Azienda</th>
              <th className="px-4 py-2 font-medium">Settore · Città</th>
              <th className="px-4 py-2 font-medium">Contatto</th>
              <th className="px-4 py-2 font-medium">Stato</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map(({ company, contact }) => (
              <tr key={company.id} className="hover:bg-stone-50">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{company.name}</div>
                  {company.website && (
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-xs text-stone-500 hover:underline">
                      {company.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </td>
                <td className="px-4 py-2.5 text-stone-600">{[company.sector, company.city].filter(Boolean).join(" · ")}</td>
                <td className="px-4 py-2.5 text-stone-600">{contact?.email ?? "—"}</td>
                <td className="px-4 py-2.5"><StatusBadge status={company.status} /></td>
                <td className="px-4 py-2.5 text-right"><RowActions id={company.id} status={company.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
