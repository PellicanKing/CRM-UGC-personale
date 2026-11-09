import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/lib/queries";
import { composeBody, getEmailProvider } from "./provider";

const STOPPED_COMPANY = new Set(["replied", "discarded"]);

/**
 * Sends one message. Hard safety checks: the message must have been explicitly
 * approved by the user (status approved/scheduled) and the sequence must not
 * have been stopped by a reply, bounce or unsubscribe.
 */
export async function sendMessage(messageId: number): Promise<void> {
  const msg = db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
  if (!msg) throw new Error("Messaggio non trovato");
  if (msg.status !== "approved" && msg.status !== "scheduled") {
    throw new Error("Il messaggio non è approvato: invio bloccato");
  }
  const company = db.select().from(schema.companies).where(eq(schema.companies.id, msg.companyId)).get();
  if (!company || STOPPED_COMPANY.has(company.status)) {
    throw new Error("Sequenza interrotta per questa azienda: invio bloccato");
  }
  const contact = msg.contactId
    ? db.select().from(schema.contacts).where(eq(schema.contacts.id, msg.contactId)).get()
    : undefined;
  if (!contact?.email) throw new Error("Email del contatto mancante");

  // Follow-ups are threaded under the first message
  let inReplyTo: string | undefined;
  if (msg.step > 0) {
    const first = db
      .select()
      .from(schema.messages)
      .where(and(eq(schema.messages.companyId, msg.companyId), eq(schema.messages.step, 0)))
      .get();
    if (first?.status !== "sent") throw new Error("Il primo messaggio non è ancora stato inviato");
    inReplyTo = first.emailMessageId ?? undefined;
  }

  const settings = getSettings();
  const subject = msg.subject ?? "";
  const res = await getEmailProvider().send({
    to: contact.email,
    subject: msg.step > 0 && !/^re:/i.test(subject) ? `Re: ${subject}` : subject,
    text: composeBody(msg.finalText ?? "", settings.signature, settings.unsubscribeText),
    inReplyTo,
  });

  db.transaction(() => {
    db.update(schema.messages)
      .set({ status: "sent", sentAt: new Date().toISOString(), emailMessageId: res.messageId })
      .where(eq(schema.messages.id, messageId))
      .run();
    db.insert(schema.events).values({ messageId, type: "sent" }).run();
    if (company.status === "approved") {
      db.update(schema.companies).set({ status: "contacted" }).where(eq(schema.companies.id, company.id)).run();
    }
  });
}
