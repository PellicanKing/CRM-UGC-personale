import type Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getClient, parse } from "@/lib/ai";
import { adLibraryUrl } from "@/lib/links";

const MODEL = "claude-opus-5-5";
const MAX_CONTINUATIONS = 8;

const LeadSchema = z.object({
  companies: z.array(
    z.object({
      name: z.string(),
      from_user: z.boolean().describe("true se è una delle aziende indicate dall'utente"),
      website: z.string().describe("URL completo o stringa vuota"),
      email: z.string().describe("Email pubblica trovata, o stringa vuota"),
      instagram: z.string().describe("URL profilo Instagram o stringa vuota"),
      tiktok: z.string().describe("URL profilo TikTok o stringa vuota"),
      facebook: z.string().describe("URL pagina Facebook o stringa vuota"),
      sector: z.string(),
      city: z.string().describe("Città o paese, o stringa vuota"),
      reason: z.string().describe("Perché è simile / perché è un buon contatto, 1 frase"),
    }),
  ),
});

const clean = (v: string) => v.trim() || null;
const url = (v: string) => (/^https?:\/\/\S+$/i.test(v.trim()) ? v.trim() : null);
const email = (v: string) => (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()) ? v.trim().toLowerCase() : null);
const domain = (u: string | null) => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "").toLowerCase() : null;
  } catch {
    return null;
  }
};
const norm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Runs the web research with Claude's server-side web search / fetch tools. */
async function research(seeds: string, notes: string | null, count: number, exclude: string[]): Promise<string> {
  const system =
    "Sei un ricercatore di contatti commerciali. L'utente è un creator che propone contenuti (es. video UGC) a brand e aziende. " +
    "Usa la ricerca web per trovare dati reali e verificabili. Non inventare mai email, profili o siti: se non trovi un dato, scrivi \"non trovato\". " +
    "Le email vanno cercate sui siti ufficiali (pagina contatti, footer, note legali, collaborazioni).";
  const user = [
    "<aziende_di_partenza>",
    seeds,
    "</aziende_di_partenza>",
    notes ? `\nCosa cerca l'utente: ${notes}` : "",
    "",
    "1. Per ogni azienda di partenza trova: nome, sito, email di contatto pubblica, profilo Instagram, profilo TikTok, pagina Facebook, settore, città/paese.",
    `2. Trova ${count} aziende SIMILI (stesso settore, prodotto, target e dimensione simili; brand che pubblicano contenuti social o fanno pubblicità) con gli stessi dati.`,
    exclude.length ? `3. Escludi queste aziende, già presenti nel CRM: ${exclude.join(", ")}.` : "",
    "",
    "Alla fine scrivi l'elenco completo, un'azienda per blocco, con tutti i campi e una frase sul perché è simile o un buon contatto.",
  ].join("\n");

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
  let finalText = "";
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const response = await getClient()
      .beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 30 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 40 },
        ],
        messages,
      })
      .finalMessage();

    if (response.stop_reason === "refusal") throw new Error("Il modello ha rifiutato la ricerca.");
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (text.trim()) finalText = text;
    if (response.stop_reason !== "pause_turn") break;
    // Long server-tool turn paused: send it back so the server continues
    messages.push({ role: "assistant", content: response.content });
  }
  if (!finalText.trim()) throw new Error("La ricerca non ha prodotto risultati.");
  return finalText;
}

/** Background job: research + extraction + insert as companies with status "lead". */
export async function runLeadSearch(searchId: number): Promise<void> {
  const search = db.select().from(schema.leadSearches).where(eq(schema.leadSearches.id, searchId)).get();
  if (!search) return;
  try {
    const existing = db.select().from(schema.companies).all();
    const knownDomains = new Set(existing.map((c) => domain(c.website)).filter(Boolean));
    const knownNames = new Set(existing.map((c) => norm(c.name)));

    const report = await research(search.seeds, search.notes, search.count, existing.slice(-200).map((c) => c.name));
    const { companies } = await parse(
      LeadSchema,
      "Estrai l'elenco di aziende dal report in modo fedele. Lascia vuoti i campi indicati come non trovati. Non aggiungere dati.",
      `<report>\n${report}\n</report>`,
      "low",
    );

    let found = 0;
    for (const c of companies) {
      const website = url(c.website);
      const d = domain(website);
      if (!c.name.trim() || knownNames.has(norm(c.name)) || (d && knownDomains.has(d))) continue;
      const facebook = url(c.facebook);
      db.transaction(() => {
        const company = db
          .insert(schema.companies)
          .values({
            name: c.name.trim(),
            website,
            sector: clean(c.sector),
            city: clean(c.city),
            instagram: url(c.instagram),
            tiktok: url(c.tiktok),
            facebookPage: facebook,
            adLibraryUrl: adLibraryUrl(c.name.trim(), facebook),
            leadReason: clean(c.reason),
            origin: c.from_user ? "utente" : "ai",
            searchId,
            status: "lead",
          })
          .returning()
          .get();
        db.insert(schema.contacts)
          .values({ companyId: company.id, email: email(c.email), source: "ricerca AI" })
          .run();
      });
      knownNames.add(norm(c.name));
      if (d) knownDomains.add(d);
      found++;
    }
    db.update(schema.leadSearches).set({ status: "done", found }).where(eq(schema.leadSearches.id, searchId)).run();
  } catch (e) {
    db.update(schema.leadSearches)
      .set({ status: "error", error: e instanceof Error ? e.message : String(e) })
      .where(eq(schema.leadSearches.id, searchId))
      .run();
  }
}

/** Searches left "running" by a previous server process can never finish. */
export function markInterruptedSearches() {
  db.update(schema.leadSearches)
    .set({ status: "error", error: "Interrotta: il CRM è stato chiuso durante la ricerca" })
    .where(eq(schema.leadSearches.status, "running"))
    .run();
}
