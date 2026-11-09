const styles: Record<string, string> = {
  new: "bg-sky-50 text-sky-700 ring-sky-200",
  review: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  contacted: "bg-violet-50 text-violet-700 ring-violet-200",
  replied: "bg-teal-50 text-teal-700 ring-teal-200",
  discarded: "bg-stone-100 text-stone-500 ring-stone-200",
};

export const statusLabels: Record<string, string> = {
  new: "Nuova",
  review: "Da revisionare",
  approved: "Approvata",
  contacted: "Contattata",
  replied: "Ha risposto",
  discarded: "Scartata",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status] ?? styles.new}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}
