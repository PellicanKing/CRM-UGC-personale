import { and, desc, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  buildProfile,
  generateSequence,
  learnStyle,
  regenerateStep,
  renderTemplate,
  templatesOf,
  type StyleExample,
} from "@/lib/ai";
import { companyMessages, getSettings, primaryContact } from "@/lib/queries";
import { fetchSiteText } from "@/lib/site";

const EXAMPLES_IN_PROMPT = 3;
const LEARN_EVERY = 3;

/** Messages the user approved after changing the AI draft. */
function editedMessages(afterId = 0, limit = 15) {
  return db
    .select({ id: schema.messages.id, aiDraft: schema.messages.aiDraft, finalText: schema.messages.finalText })
    .from(schema.messages)
    .where(
      and(
        inArray(schema.messages.status, ["approved", "scheduled", "sent"]),
        isNotNull(schema.messages.aiDraft),
        gt(schema.messages.id, afterId),
      ),
    )
    .orderBy(desc(schema.messages.id))
    .all()
    .filter((m) => m.aiDraft && m.finalText && m.aiDraft.trim() !== m.finalText.trim())
    .slice(0, limit) as { id: number; aiDraft: string; finalText: string }[];
}

function styleContext(): { learnedStyle: string | null; examples: StyleExample[] } {
  return { learnedStyle: getSettings().learnedStyle, examples: editedMessages(0, EXAMPLES_IN_PROMPT) };
}

/** Reads the website, builds the profile and writes the whole sequence. */
export async function generateForCompany(companyId: number, instruction?: string): Promise<void> {
  let company = db.select().from(schema.companies).where(eq(schema.companies.id, companyId)).get();
  if (!company) throw new Error("Azienda non trovata");
  const siteText = company.website ? await fetchSiteText(company.website) : null;
  const profile = await buildProfile(company, siteText);
  company = db.update(schema.companies).set(profile).where(eq(schema.companies.id, companyId)).returning().get();

  const contact = primaryContact(companyId);
  const templates = templatesOf(getSettings());
  const seq = await generateSequence({ company, contact, templates, instruction, ...styleContext() });
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
    steps.forEach((m, step) => {
      const tpl = templates[step];
      const body = tpl.trim()
        ? renderTemplate(tpl, { nome: contact?.name ?? null, azienda: company.name, personalizzazione: m.text })
        : m.text;
      db.insert(schema.messages)
        .values({ companyId, contactId: contact?.id ?? null, step, subject: m.subject, aiDraft: body, finalText: body, status: "draft" })
        .run();
    });
    db.update(schema.companies).set({ dmText: seq.social_dm, status: "review" }).where(eq(schema.companies.id, companyId)).run();
  });
}

/** Rewrites one step; returns the new subject and full text. */
export async function regenerateMessageText(messageId: number, instruction?: string) {
  const msg = db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
  if (!msg) throw new Error("Messaggio non trovato");
  const company = db.select().from(schema.companies).where(eq(schema.companies.id, msg.companyId)).get()!;
  const contact = primaryContact(company.id);
  const template = templatesOf(getSettings())[msg.step] ?? "";
  const out = await regenerateStep({
    company,
    contact,
    step: msg.step,
    template,
    current: msg.finalText ?? "",
    others: companyMessages(company.id).map((m) => ({ subject: m.subject, text: m.finalText })),
    instruction,
    ...styleContext(),
  });
  const body = template.trim()
    ? renderTemplate(template, { nome: contact?.name ?? null, azienda: company.name, personalizzazione: out.text })
    : out.text;
  db.update(schema.messages)
    .set({ subject: out.subject, aiDraft: body, finalText: body, status: "draft" })
    .where(eq(schema.messages.id, messageId))
    .run();
  return { subject: out.subject, text: body };
}

let learning = false;

/** Updates the learned style. `force` ignores the "every N edits" threshold. */
export async function maybeLearnStyle(force = false): Promise<{ learned: boolean; pending: number }> {
  const s = getSettings();
  const fresh = editedMessages(s.styleLastMessageId ?? 0);
  if (learning || fresh.length === 0 || (!force && fresh.length < LEARN_EVERY)) {
    return { learned: false, pending: fresh.length };
  }
  learning = true;
  try {
    const examples = editedMessages(0, 15);
    const style = await learnStyle(s.learnedStyle, examples);
    db.update(schema.settings)
      .set({ learnedStyle: style, styleLastMessageId: Math.max(...fresh.map((m) => m.id)) })
      .where(eq(schema.settings.id, 1))
      .run();
    return { learned: true, pending: 0 };
  } finally {
    learning = false;
  }
}

export function pendingStyleEdits(): number {
  return editedMessages(getSettings().styleLastMessageId ?? 0).length;
}
