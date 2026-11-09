import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Company, Contact } from "@/db/schema";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY mancante: aggiungila in .env.local");
  }
  client ??= new Anthropic();
  return client;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function readTone(): Promise<string> {
  try {
    return await fs.readFile(path.join(process.cwd(), "prompts", "tono.md"), "utf8");
  } catch {
    return "Tono cordiale, breve, professionale. In italiano.";
  }
}

/**
 * Structured-output call. Uses server-side fallbacks so a refusal on the
 * primary model is retried automatically on a fallback model.
 */
async function parse<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
): Promise<z.infer<T>> {
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("Il modello ha rifiutato la richiesta.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Risposta troncata (max_tokens).");
  }
  if (!response.parsed_output) {
    throw new Error("Risposta AI non valida.");
  }
  return response.parsed_output as z.infer<T>;
}

// ---------- Company profile ----------

const ProfileSchema = z.object({
  summary: z.string().describe("Cosa fa l'azienda, 2-3 frasi"),
  target: z.string().describe("A chi si rivolge"),
  weaknesses: z.string().describe("Punti deboli osservabili nella presenza online"),
  hook: z.string().describe("Un aggancio specifico e verificabile per il primo messaggio"),
});
export type Profile = z.infer<typeof ProfileSchema>;

export async function buildProfile(company: Company, siteText: string | null): Promise<Profile> {
  const system =
    "Sei un analista che prepara schede aziendali per un professionista che fa outreach a piccole imprese italiane. " +
    "Usa solo le informazioni fornite: se un dato non c'è, dillo invece di inventarlo. Scrivi in italiano.";
  const user = [
    `Azienda: ${company.name}`,
    `Settore: ${company.sector ?? "n/d"}`,
    `Città: ${company.city ?? "n/d"}`,
    `Sito: ${company.website ?? "n/d"}`,
    `Instagram: ${company.instagram ?? "assente"}`,
    `Pagina Facebook: ${company.facebookPage ?? "assente"}`,
    "",
    "<testo_sito>",
    siteText ?? "(sito non disponibile)",
    "</testo_sito>",
    "",
    "Prepara la scheda: cosa fanno, target, punti deboli, aggancio.",
  ].join("\n");
  return parse(ProfileSchema, system, user);
}

// ---------- Messages ----------

const MessageSchema = z.object({
  subject: z.string(),
  body: z.string().describe("Testo dell'email senza firma e senza riga di disiscrizione"),
});

const SequenceSchema = z.object({
  first: MessageSchema,
  followup1: MessageSchema,
  followup2: MessageSchema,
  instagram_dm: z.string().describe("Versione breve per DM Instagram, max 50 parole"),
});
export type GeneratedSequence = z.infer<typeof SequenceSchema>;

function companyContext(company: Company, contact: Contact | null): string {
  return [
    `Azienda: ${company.name} (${company.sector ?? "settore n/d"}, ${company.city ?? "città n/d"})`,
    `Contatto: ${contact?.name ?? "sconosciuto"}${contact?.role ? `, ${contact.role}` : ""}`,
    `Cosa fanno: ${company.summary ?? "n/d"}`,
    `Target: ${company.target ?? "n/d"}`,
    `Punti deboli: ${company.weaknesses ?? "n/d"}`,
    `Aggancio: ${company.hook ?? "n/d"}`,
  ].join("\n");
}

async function messagesSystem(): Promise<string> {
  return (
    "Scrivi email di primo contatto e follow-up per conto dell'utente. " +
    "Segui rigorosamente le linee guida di tono qui sotto. Non inserire firma né riga di disiscrizione: vengono aggiunte automaticamente. " +
    "Non inventare fatti sull'azienda oltre a quelli forniti.\n\n" +
    (await readTone())
  );
}

export async function generateSequence(
  company: Company,
  contact: Contact | null,
  instruction?: string,
): Promise<GeneratedSequence> {
  const user =
    companyContext(company, contact) +
    "\n\nScrivi: primo messaggio, follow-up 1, follow-up 2 e un DM Instagram." +
    (instruction ? `\n\nIndicazioni aggiuntive dell'utente: ${instruction}` : "");
  return parse(SequenceSchema, await messagesSystem(), user);
}

export async function regenerateStep(
  company: Company,
  contact: Contact | null,
  step: number,
  previous: { subject: string | null; text: string | null }[],
  instruction?: string,
): Promise<z.infer<typeof MessageSchema>> {
  const label = step === 0 ? "il primo messaggio" : `il follow-up ${step}`;
  const others = previous
    .map((m, i) => (i === step ? null : `--- Step ${i} ---\nOggetto: ${m.subject}\n${m.text}`))
    .filter(Boolean)
    .join("\n\n");
  const user =
    companyContext(company, contact) +
    `\n\nAltri messaggi della sequenza (per coerenza):\n${others || "(nessuno)"}` +
    `\n\nVersione attuale da migliorare:\n${previous[step]?.text ?? "(nessuna)"}` +
    `\n\nRiscrivi ${label} con un approccio diverso.` +
    (instruction ? `\nIndicazioni dell'utente: ${instruction}` : "");
  return parse(MessageSchema, await messagesSystem(), user);
}
