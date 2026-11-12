import { generateForCompany } from "@/lib/generate";
import { runLeadSearch } from "@/lib/leads";

// In-process background work (single user, single server process).
type DraftJob = { queue: number[]; running: boolean; done: number; total: number; current: number | null; errors: string[] };
const g = globalThis as unknown as { __drafts?: DraftJob; __searches?: Set<number> };
const drafts = (g.__drafts ??= { queue: [], running: false, done: 0, total: 0, current: null, errors: [] });
const searches = (g.__searches ??= new Set());

export function draftJobStatus() {
  return { running: drafts.running, done: drafts.done, total: drafts.total, current: drafts.current, queued: [...drafts.queue], errors: drafts.errors.slice(-5) };
}

/** Queues companies for profile + message generation, one at a time. */
export function enqueueDrafts(companyIds: number[]) {
  if (!drafts.running) {
    drafts.done = 0;
    drafts.total = 0;
    drafts.errors = [];
  }
  for (const id of companyIds) {
    if (!drafts.queue.includes(id) && drafts.current !== id) {
      drafts.queue.push(id);
      drafts.total++;
    }
  }
  if (!drafts.running) void processDrafts();
}

async function processDrafts() {
  drafts.running = true;
  try {
    while (drafts.queue.length) {
      const id = drafts.queue.shift()!;
      drafts.current = id;
      try {
        await generateForCompany(id);
      } catch (e) {
        drafts.errors.push(`Azienda ${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
      drafts.done++;
    }
  } finally {
    drafts.current = null;
    drafts.running = false;
  }
}

export function startLeadSearch(searchId: number) {
  if (searches.has(searchId)) return;
  searches.add(searchId);
  void runLeadSearch(searchId).finally(() => searches.delete(searchId));
}
