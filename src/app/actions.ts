"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { buildProfile, generateSequence, regenerateStep } from "@/lib/ai";
import { adLibraryUrl } from "@/lib/links";
import { companyMessages, primaryContact } from "@/lib/queries";
import { fetchSiteText } from "@/lib/site";

export type ActionResult = { ok: true } | { ok: false, error: string };

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

function getCompany(id: number) {
  const company = db.select().from(schema.companies).where(eq(schema.companies.id, id)).get();
  if (!company) throw new Error("Azienda non trovata");
  return company;
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
    const msg = db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
    if (!msg) throw new Error("Messaggio non trovato");
    const company = getCompany(msg.companyId);
    const all = companyMessages(company.id).map((m) => ({ subject: m.subject, text: m.finalText }));
    const out = await regenerateStep(company, primaryContact(company.id), msg.step, all, instruction);
    db.update(schema.messages)
      .set({ subject: out.subject, aiDraft: out.body, finalText: out.body, status: "draft" })
      .where(eq(schema.messages.id, messageId))
      .run();
    revalidatePath("/review");
    return { ok: true, subject: out.subject, text: out.body };
  } catch (e) {
    return fail(e);
  }
}

/** Reads the website, builds the profile and generates the full sequence. */
export async function enrichAndGenerate(
  companyId: number,
  instruction?: string,
): Promise<ActionResult> {
  try {
    let company = getCompany(companyId);
    const siteText = company.website ? await fetchSiteText(company.website) : null;
    const profile = await buildProfile(company, siteText);
    company = db
      .update(schema.companies)
      .set({ ...profile })
      .where(eq(schema.companies.id, companyId))
      .returning()
      .get();

    const contact = primaryContact(companyId);
    const seq = await generateSequence(company, contact, instruction);
    const steps = [seq.first, seq.followup1, seq.followup2];

    db.transaction(() => {
      // Replace only unsent drafts; never touch sent/scheduled messages
      db.delete(schema.messages)
        .where(
          and(
            eq(schema.messages.companyId, companyId),
            inArray(schema.messages.status, ["draft", "approved", "cancelled"]),
          ),
        )
        .run();
      steps.forEach((m, step) =>
        db.insert(schema.messages)
          .values({
            companyId,
            contactId: contact?.id ?? null,
            step,
            subject: m.subject,
            aiDraft: m.body,
            finalText: m.body,
            status: "draft",
          })
          .run(),
      );
      db.update(schema.companies)
        .set({ dmText: seq.instagram_dm, status: "review" })
        .where(eq(schema.companies.id, companyId))
        .run();
    });
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
          facebookPage: orNull(d.facebookPage),
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
    revalidatePath("/settings");
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
