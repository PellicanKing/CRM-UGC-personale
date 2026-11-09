"use client";

import { useTransition } from "react";
import { backToReview } from "../actions";

export default function RowActions({ id, status }: { id: number; status: string }) {
  const [pending, start] = useTransition();
  if (!["approved", "discarded"].includes(status)) return null;
  return (
    <button className="text-xs text-stone-500 hover:text-stone-900 hover:underline" disabled={pending} onClick={() => start(async () => void (await backToReview(id)))}>
      {pending ? "…" : "Riporta in revisione"}
    </button>
  );
}
