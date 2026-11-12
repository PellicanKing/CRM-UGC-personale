"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { DEFAULT_TEMPLATES } from "@/lib/ai";
import { generateForCompany, maybeLearnStyle, regenerateMessageText } from "@/lib/generate";
import { draftJobStatus, enqueueDrafts, startLeadSearch } from "@/lib/jobs";
import { adLibraryUrl } from "@/lib/links";
import { companyMessages, primaryContact } from "@/lib/queries";
import { planSchedule, replanAll } from "@/lib/scheduler/plan";

export type ActionResult = { ok: true } | { ok: false, error: string };

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

const EditSchema = z.object({
  id: z.number().int(),
  subject: z.string(),
  text: z.string(),
});
type Edit = z.infer<typeof EditSchema>;

function applyEdits(companyId: number, edits: Edit[]) {
  for (const e of z.array(EditSchema).parse(edits)) {
    db.update(schema.messages)
      .set({ subject: e.subject, finalText: e.text })
      .where(and(eq(schema.messages.id, e.id), eq(schema.messages.companyId, companyId)))
      .run();
  }
}

/** Saves edited drafts without approving. */
export async function saveDrafts(companyId: number, edits: Edit[]): Promise<ActionResult> {
  try {
    applyEdits(companyId, edits);
    revalidatePath("/review");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Explicit user approval. Marks the sequence as approved; nothing is sent here.
 * Scheduling/sending is a separate, later step.
 */
export async function approveCompany(companyId: number, edits: Edit[]): Promise<ActionResult> {
  try {
    const msgs = companyMessages(companyId);
    if (msgs.length === 0) throw new Error("Nessun messaggio da approvare");
    if (!primaryContact(companyId)?.email) throw new Error("Manca l'email del contatto");
    const finalTexts = msgs.map((m) => edits.find((e) => e.id === m.id)?.text ?? m.finalText ?? "");
    if (finalTexts.some((t) => /\{\{|\}\}/.test(t))) {
      throw new Error("Nel testo è rimasto un segnaposto {{…}}: correggilo prima di approvare");
    }
    db.transaction(() => {
      applyEdits(companyId, edits);
      db.update(schema.messages)
        .set({ status: "approved" })
        .where(and(eq(schema.messages.companyId, companyId), eq(schema.messages.status, "draft")))
        .run();
      db.update(schema.companies)
        .set({ status: "approved" })
        .where(eq(schema.companies.id, companyId))
        .run();
    });
    planSchedule();
    // Learn from the user's edits in the background (every few edited emails)
    void maybeLearnStyle().catch((e) => console.error("[style]", e));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function discardCompany(companyId: number): Promise<ActionResult> {
  try {
    db.transaction(() => {
      db.update(schema.messages)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(schema.messages.companyId, companyId),
            inArray(schema.messages.status, ["draft", "approved", "scheduled"]),
          ),
        )
        .run();
      db.update(schema.companies)
        .set({ status: "discarded" })
        .where(eq(schema.companies.id, companyId))
        .run();
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Puts a company back into the review queue (e.g. after approving by mistake). */
export async function backToReview(companyId: number): Promise<ActionResult> {
  try {
    db.transaction(() => {
      db.update(schema.messages)
        .set({ status: "draft" })
        .where(
          and(
            eq(schema.messages.companyId, companyId),
            inArray(schema.messages.status, ["approved", "cancelled"]),
          ),
        )
        .run();
      db.update(schema.companies)
        .set({ status: "review" })
        .where(eq(schema.companies.id, companyId))
        .run();
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Regenerates one step of the sequence with Claude. */
export async function regenerateMessage(
  messageId: number,
  instruction?: string,
): Promise<ActionResult & { subject?: string; text?: string }> {
  try {
    const out = await regenerateMessageText(messageId, instruction);
    revalidatePath("/review");
    return { ok: true, ...out };
  } catch (e) {
    return fail(e);
  }
}

/** Reads the website, builds the profile and generates the full sequence. */
export async function enrichAndGenerate(companyId: number, instruction?: string): Promise<ActionResult> {
  try {
    await generateForCompany(companyId, instruction);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const CompanyFormSchema = z.object({
  name: z.string().trim().min(1, "Nome obbligatorio"),
  website: z.string().trim().optional(),
  sector: z.string().trim().optional(),
  city: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
  tiktok: z.string().trim().optional(),
  facebookPage: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  contactRole: z.string().trim().optional(),
  email: z.string().trim().optional(),
});

const orNull = (v?: string) => (v ? v : null);

export async function addCompany(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const d = CompanyFormSchema.parse(Object.fromEntries(form));
    if (d.email && !z.email().safeParse(d.email).success) throw new Error("Email non valida");
    db.transaction(() => {
      const company = db
        .insert(schema.companies)
        .values({
          name: d.name,
          website: orNull(d.website),
          sector: orNull(d.sector),
          city: orNull(d.city),
          instagram: orNull(d.instagram),
          tiktok: orNull(d.tiktok),
          facebookPage: orNull(d.facebookPage),
          origin: "utente",
          adLibraryUrl: adLibraryUrl(d.name, d.facebookPage),
          status: "new",
        })
        .returning()
        .get();
      if (d.email || d.contactName) {
        db.insert(schema.contacts)
          .values({
            companyId: company.id,
            name: orNull(d.contactName),
            role: orNull(d.contactRole),
            email: orNull(d.email),
            source: "manuale",
          })
          .run();
      }
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dati non validi" };
    return fail(e);
  }
}

const time = z.string().regex(/^\d{2}:\d{2}$/, "Orario non valido (HH:MM)");
const SettingsSchema = z
  .object({
    sendDays: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Scegli almeno un giorno"),
    windowStart: time,
    windowEnd: time,
    timezone: z.string().min(1),
    dailyLimit: z.coerce.number().int().min(1).max(500),
    minIntervalMin: z.coerce.number().int().min(1),
    maxIntervalMin: z.coerce.number().int().min(1),
    followup1: z.coerce.number().int().min(1),
    followup2: z.coerce.number().int().min(1),
    signature: z.string(),
    unsubscribeText: z.string().trim().min(1, "Il testo di disiscrizione è obbligatorio"),
  })
  .refine((s) => s.minIntervalMin <= s.maxIntervalMin, "Intervallo minimo > massimo")
  .refine((s) => s.windowStart < s.windowEnd, "La fascia oraria non è valida");

export async function updateSettings(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const raw = Object.fromEntries(form);
    const s = SettingsSchema.parse({ ...raw, sendDays: form.getAll("sendDays") });
    db.update(schema.settings)
      .set({
        sendDays: s.sendDays,
        windowStart: s.windowStart,
        windowEnd: s.windowEnd,
        timezone: s.timezone,
        dailyLimit: s.dailyLimit,
        minIntervalMin: s.minIntervalMin,
        maxIntervalMin: s.maxIntervalMin,
        followupDays: [s.followup1, s.followup2],
        signature: s.signature,
        unsubscribeText: s.unsubscribeText,
      })
      .where(eq(schema.settings.id, 1))
      .run();
    replanAll();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dati non validi" };
    return fail(e);
  }
}

// ---------- Email (Proton) ----------

export async function testEmailConnection(): Promise<ActionResult & { detail?: string }> {
  const { getEmailProvider } = await import("@/lib/email/provider");
  const { imapConfig, providerName } = await import("@/lib/email/config");
  try {
    const provider = getEmailProvider();
    await provider.verify();
    let detail = `Invio: ${provider.name} OK`;
    if (providerName() === "proton" && imapConfig()) {
      const { checkInbox } = await import("@/lib/email/inbox");
      await checkInbox(1);
      detail += " · Lettura posta (IMAP): OK";
    } else if (providerName() === "proton") {
      detail += " · IMAP non configurato: risposte non rilevate";
    }
    return { ok: true, detail };
  } catch (e) {
    return fail(e);
  }
}

/** Sends a test email to the user's own address (never to a lead). */
export async function sendTestEmail(): Promise<ActionResult> {
  const { composeBody, getEmailProvider } = await import("@/lib/email/provider");
  const { fromAddress } = await import("@/lib/email/config");
  const { getSettings } = await import("@/lib/queries");
  try {
    const s = getSettings();
    await getEmailProvider().send({
      to: fromAddress().address,
      subject: "Email di prova dal CRM",
      text: composeBody("Questa è un'email di prova: se la leggi, l'invio funziona.", s.signature, s.unsubscribeText),
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function runInboxCheck(): Promise<ActionResult & { detail?: string }> {
  const { checkInbox } = await import("@/lib/email/inbox");
  try {
    const r = await checkInbox();
    revalidatePath("/", "layout");
    return {
      ok: true,
      detail: `${r.scanned} email lette · ${r.replied} risposte · ${r.bounced} bounce · ${r.unsubscribed} disiscrizioni`,
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Scheduling ----------

export async function setSendingEnabled(enabled: boolean): Promise<ActionResult> {
  try {
    db.update(schema.settings).set({ sendingEnabled: enabled }).where(eq(schema.settings.id, 1)).run();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function replanQueue(): Promise<ActionResult & { detail?: string }> {
  try {
    const n = replanAll();
    revalidatePath("/", "layout");
    return { ok: true, detail: `${n} invii riprogrammati` };
  } catch (e) {
    return fail(e);
  }
}

/** Manual move of a single send. `local` is "YYYY-MM-DDTHH:mm" in the sending timezone. */
export async function rescheduleMessage(messageId: number, local: string): Promise<ActionResult> {
  const { DateTime } = await import("luxon");
  const { getSettings } = await import("@/lib/queries");
  try {
    const msg = db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
    if (!msg || msg.status !== "scheduled") throw new Error("Si possono spostare solo invii programmati");
    const t = DateTime.fromISO(local, { zone: getSettings().timezone });
    if (!t.isValid) throw new Error("Data non valida");
    if (t < DateTime.now().plus({ minutes: 1 })) throw new Error("Scegli un orario futuro");
    db.update(schema.messages)
      .set({ scheduledAt: t.toUTC().toISO(), manualSchedule: true })
      .where(eq(schema.messages.id, messageId))
      .run();
    revalidatePath("/scheduled");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Lead list ----------

const SearchSchema = z.object({
  seeds: z.string().trim().min(3, "Scrivi almeno un'azienda di partenza"),
  notes: z.string().trim().optional(),
  count: z.coerce.number().int().min(1).max(30),
});

export async function createLeadSearch(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Prima collega l'AI (ANTHROPIC_API_KEY con CONFIGURA)");
    const d = SearchSchema.parse(Object.fromEntries(form));
    const search = db
      .insert(schema.leadSearches)
      .values({ seeds: d.seeds, notes: d.notes || null, count: d.count })
      .returning()
      .get();
    startLeadSearch(search.id);
    revalidatePath("/leads");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dati non validi" };
    return fail(e);
  }
}

export async function updateLeadEmail(companyId: number, email: string): Promise<ActionResult> {
  try {
    const value = email.trim().toLowerCase();
    if (value && !z.email().safeParse(value).success) throw new Error("Email non valida");
    const contact = primaryContact(companyId);
    if (contact) {
      db.update(schema.contacts).set({ email: value || null }).where(eq(schema.contacts.id, contact.id)).run();
    } else if (value) {
      db.insert(schema.contacts).values({ companyId, email: value, source: "manuale" }).run();
    }
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function discardLeads(ids: number[]): Promise<ActionResult> {
  try {
    db.update(schema.companies)
      .set({ status: "discarded" })
      .where(and(inArray(schema.companies.id, ids), eq(schema.companies.status, "lead")))
      .run();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Moves the chosen leads to writing mode and prepares their drafts in the background. */
export async function startWriting(ids: number[]): Promise<ActionResult> {
  try {
    if (ids.length === 0) throw new Error("Seleziona almeno un'azienda");
    db.update(schema.companies)
      .set({ status: "new" })
      .where(and(inArray(schema.companies.id, ids), eq(schema.companies.status, "lead")))
      .run();
    if (process.env.ANTHROPIC_API_KEY) enqueueDrafts(ids);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function getDraftJob() {
  return draftJobStatus();
}

// ---------- Templates and learned style ----------

export async function updateWriting(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const templates = [0, 1, 2].map((i) => String(form.get(`template${i}`) ?? "").replace(/\r\n/g, "\n"));
    const unknown = templates.join(" ").match(/\{\{(?!nome\}\}|azienda\}\}|personalizzazione\}\})[^}]*\}\}/);
    if (unknown) throw new Error(`Segnaposto sconosciuto: ${unknown[0]}`);
    const learnedStyle = String(form.get("learnedStyle") ?? "").trim();
    db.update(schema.settings)
      .set({ templates, learnedStyle: learnedStyle || null })
      .where(eq(schema.settings.id, 1))
      .run();
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resetTemplates(): Promise<ActionResult> {
  db.update(schema.settings).set({ templates: DEFAULT_TEMPLATES }).where(eq(schema.settings.id, 1)).run();
  revalidatePath("/settings");
  return { ok: true };
}

export async function learnStyleNow(): Promise<ActionResult & { detail?: string }> {
  try {
    const r = await maybeLearnStyle(true);
    revalidatePath("/settings");
    return { ok: true, detail: r.learned ? "Stile aggiornato" : "Nessuna nuova correzione da cui imparare" };
  } catch (e) {
    return fail(e);
  }
}
