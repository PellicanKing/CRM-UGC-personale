import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Company, Contact, Settings } from "@/db/schema";

const MODEL = "claude-opus-5-5";
// Server-side fallback: a refusal on the primary model is retried on a fallback model
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

let client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY mancante: aggiungila con CONFIGURA");
  }
  client ??= new Anthropic();
  return client;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function readTone(): Promise<string> {
  try {
    return await fs.readFile(path.join(process.cwd(), "prompts", "tono.md"), "utf8");
  } catch {
    return "Tono cordiale, breve, professionale. In italiano.";
  }
}

/** Structured-output call (no tools). */
export async function parse<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
  effort: "low" | "medium" | "high" = "medium",
): Promise<z.infer<T>> {
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw new Error("Il modello ha rifiutato la richiesta.");
  if (response.stop_reason === "max_tokens") throw new Error("Risposta troncata (max_tokens).");
  if (!response.parsed_output) throw new Error("Risposta AI non valida.");
  return response.parsed_output as z.infer<T>;
}

// ---------- Company profile ----------

const ProfileSchema = z.object({
  summary: z.string().describe("Cosa fa l'azienda, 2-3 frasi"),
  target: z.string().describe("A chi si rivolge"),
  weaknesses: z.string().describe("Punti deboli osservabili nella presenza online e nei contenuti"),
  hook: z.string().describe("Un aggancio specifico e verificabile per il primo messaggio"),
});
export type Profile = z.infer<typeof ProfileSchema>;

export async function buildProfile(company: Company, siteText: string | null): Promise<Profile> {
  const system =
    "Prepari schede aziendali per un professionista che contatta brand e aziende per proporre i propri servizi. " +
    "Usa solo le informazioni fornite: se un dato non c'è, dillo invece di inventarlo. Scrivi in italiano.";
  const user = [
    `Azienda: ${company.name}`,
    `Settore: ${company.sector ?? "n/d"}`,
    `Città: ${company.city ?? "n/d"}`,
    `Sito: ${company.website ?? "n/d"}`,
    `Instagram: ${company.instagram ?? "assente"}`,
    `TikTok: ${company.tiktok ?? "assente"}`,
    `Pagina Facebook: ${company.facebookPage ?? "assente"}`,
    company.leadReason ? `Note dalla ricerca: ${company.leadReason}` : "",
    "",
    "<testo_sito>",
    siteText ?? "(sito non disponibile)",
    "</testo_sito>",
    "",
    "Prepara la scheda: cosa fanno, target, punti deboli, aggancio.",
  ].join("\n");
  return parse(ProfileSchema, system, user);
}

// ---------- Templates ----------

export const DEFAULT_TEMPLATES = [
  "Ciao {{nome}},\n\n{{personalizzazione}}\n\nCreo contenuti UGC: video brevi e spontanei per Instagram e TikTok, pensati per far conoscere prodotti come quelli di {{azienda}}.\n\nTi andrebbe se ti preparassi un'idea di video per uno dei vostri prodotti?",
  "",
  "",
];

export function templatesOf(s: Settings): string[] {
  const t = s.templates ?? DEFAULT_TEMPLATES;
  return [0, 1, 2].map((i) => t[i] ?? "");
}

const usesSlot = (template: string) => template.includes("{{personalizzazione}}");

/** Fills a template. A missing first name turns "Ciao {{nome}}," into "Ciao,". */
export function renderTemplate(
  template: string,
  vars: { nome: string | null; azienda: string; personalizzazione: string },
): string {
  const firstName = vars.nome?.replace(/^(dott\.?ssa|dott\.?|sig\.?ra|sig\.?)\s+/i, "").split(/\s+/)[0] ?? "";
  return template
    .replace(/\s*\{\{nome\}\}/g, firstName ? ` ${firstName}` : "")
    .replace(/\{\{azienda\}\}/g, vars.azienda.replace(/\s*\(esempio\)$/, ""))
    .replace(/\{\{personalizzazione\}\}/g, vars.personalizzazione.trim());
}

// ---------- Messages ----------

const StepSchema = z.object({
  subject: z.string(),
  text: z.string().describe("Il testo richiesto per questo step (vedi istruzioni)"),
});

const SequenceSchema = z.object({
  first: StepSchema,
  followup1: StepSchema,
  followup2: StepSchema,
  social_dm: z.string().describe("Versione breve per DM Instagram/TikTok, max 50 parole"),
});
export type GeneratedSequence = z.infer<typeof SequenceSchema>;

export type StyleExample = { aiDraft: string; finalText: string };

function companyContext(company: Company, contact: Contact | null): string {
  return [
    `Azienda: ${company.name} (${company.sector ?? "settore n/d"}, ${company.city ?? "luogo n/d"})`,
    `Contatto: ${contact?.name ?? "sconosciuto"}${contact?.role ? `, ${contact.role}` : ""}`,
    `Cosa fanno: ${company.summary ?? "n/d"}`,
    `Target: ${company.target ?? "n/d"}`,
    `Punti deboli: ${company.weaknesses ?? "n/d"}`,
    `Aggancio: ${company.hook ?? "n/d"}`,
  ].join("\n");
}

function stepInstruction(label: string, template: string): string {
  if (!template.trim()) return `- ${label}: "text" è l'intero corpo dell'email.`;
  if (usesSlot(template)) {
    return (
      `- ${label}: l'email usa un template fisso dell'utente. "text" è SOLO la parte personalizzata ` +
      `che sostituisce {{personalizzazione}} (1-3 frasi su un dettaglio concreto e specifico dell'azienda), ` +
      `senza saluto né chiusura. Template:\n"""\n${template}\n"""`
    );
  }
  return `- ${label}: l'email è un template fisso; "text" deve essere una stringa vuota. Template:\n"""\n${template}\n"""`;
}

async function messagesSystem(learnedStyle: string | null, examples: StyleExample[]): Promise<string> {
  const parts = [
    "Scrivi email di primo contatto e follow-up per conto dell'utente. Segui le linee guida di tono qui sotto. " +
      "Non inserire firma né riga di disiscrizione: vengono aggiunte automaticamente. " +
      "Non inventare fatti sull'azienda oltre a quelli forniti.",
    "<tono>\n" + (await readTone()) + "\n</tono>",
  ];
  if (learnedStyle?.trim()) {
    parts.push(
      "<stile_utente>\nNote su come scrive davvero l'utente, ricavate dalle sue correzioni. Hanno la precedenza sul tono generico.\n" +
        learnedStyle.trim() +
        "\n</stile_utente>",
    );
  }
  if (examples.length) {
    parts.push(
      "<esempi_correzioni>\nBozze dell'AI e versione finale scritta dall'utente. Imita la versione finale.\n" +
        examples
          .map((e, i) => `<esempio n="${i + 1}">\n<bozza>\n${e.aiDraft}\n</bozza>\n<finale>\n${e.finalText}\n</finale>\n</esempio>`)
          .join("\n") +
        "\n</esempi_correzioni>",
    );
  }
  return parts.join("\n\n");
}

export async function generateSequence(opts: {
  company: Company;
  contact: Contact | null;
  templates: string[];
  learnedStyle: string | null;
  examples: StyleExample[];
  instruction?: string;
}): Promise<GeneratedSequence> {
  const { company, contact, templates } = opts;
  const user = [
    companyContext(company, contact),
    "",
    "Scrivi primo messaggio, follow-up 1, follow-up 2 e un DM per Instagram/TikTok.",
    "Per ogni step:",
    stepInstruction("Primo messaggio", templates[0]),
    stepInstruction("Follow-up 1 (dopo 7 giorni senza risposta)", templates[1]),
    stepInstruction("Follow-up 2 (ultimo, chiusura cortese)", templates[2]),
    opts.instruction ? `\nIndicazioni aggiuntive dell'utente: ${opts.instruction}` : "",
  ].join("\n");
  return parse(SequenceSchema, await messagesSystem(opts.learnedStyle, opts.examples), user);
}

export async function regenerateStep(opts: {
  company: Company;
  contact: Contact | null;
  step: number;
  template: string;
  current: string;
  others: { subject: string | null; text: string | null }[];
  learnedStyle: string | null;
  examples: StyleExample[];
  instruction?: string;
}): Promise<z.infer<typeof StepSchema>> {
  const label = opts.step === 0 ? "Primo messaggio" : `Follow-up ${opts.step}`;
  const others = opts.others
    .map((m, i) => (i === opts.step ? null : `--- Step ${i} ---\nOggetto: ${m.subject}\n${m.text}`))
    .filter(Boolean)
    .join("\n\n");
  const user = [
    companyContext(opts.company, opts.contact),
    `\nAltri messaggi della sequenza (per coerenza):\n${others || "(nessuno)"}`,
    `\nVersione attuale:\n${opts.current || "(nessuna)"}`,
    `\nRiscrivi con un approccio diverso:`,
    stepInstruction(label, opts.template),
    opts.instruction ? `\nIndicazioni dell'utente: ${opts.instruction}` : "",
  ].join("\n");
  return parse(StepSchema, await messagesSystem(opts.learnedStyle, opts.examples), user);
}

// ---------- Style learning ----------

export async function learnStyle(previous: string | null, examples: StyleExample[]): Promise<string> {
  const Out = z.object({ style: z.string().describe("Note di stile aggiornate, elenco puntato, max 15 punti") });
  const system =
    "Analizzi come una persona corregge le bozze scritte da un'AI, per descrivere il suo modo di scrivere. " +
    "Descrivi regole concrete e riutilizzabili (lunghezza, saluti, lessico, frasi che toglie o aggiunge, tono, punteggiatura, " +
    "come chiude, cosa evita). Niente dettagli specifici di una singola azienda. Scrivi in italiano.";
  const user =
    `<note_attuali>\n${previous?.trim() || "(nessuna)"}\n</note_attuali>\n\n` +
    examples
      .map((e, i) => `<correzione n="${i + 1}">\n<bozza_ai>\n${e.aiDraft}\n</bozza_ai>\n<versione_utente>\n${e.finalText}\n</versione_utente>\n</correzione>`)
      .join("\n") +
    "\n\nAggiorna le note di stile: mantieni ciò che è ancora valido, correggi o aggiungi in base alle nuove correzioni.";
  return (await parse(Out, system, user, "medium")).style;
}
