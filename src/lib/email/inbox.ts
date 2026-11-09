import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import { db, schema } from "@/db";
import type { EventType } from "@/db/schema";
import { imapConfig } from "./config";

// Phrases that mean "stop writing to me"
const UNSUBSCRIBE_RE =
  /\b(no,? grazie|non (mi )?scriv|non contattarmi|non sono interessat|disiscriv|cancellami|rimuovimi|unsubscribe|stop)\b/i;
const BOUNCE_FROM_RE = /mailer-daemon|postmaster/i;
const BOUNCE_SUBJECT_RE = /undeliver|delivery status|non recapitat|mail delivery failed|returned mail/i;

export type InboxResult = { scanned: number; replied: number; bounced: number; unsubscribed: number };

function addresses(a: AddressObject | AddressObject[] | undefined): string[] {
  const list = Array.isArray(a) ? a : a ? [a] : [];
  return list.flatMap((x) => x.value.map((v) => v.address?.toLowerCase() ?? "")).filter(Boolean);
}

/** Stops the whole sequence for a company and records the event. */
function stopSequence(companyId: number, messageId: number, type: EventType, sourceMessageId: string) {
  db.transaction(() => {
    db.insert(schema.events).values({ messageId, type, sourceMessageId }).run();
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
      .set({ status: type === "replied" ? "replied" : "discarded" })
      .where(eq(schema.companies.id, companyId))
      .run();
  });
}

/**
 * Scans the inbox (via Proton Mail Bridge IMAP) for replies, bounces and
 * unsubscribe requests to sent messages, and stops the matching sequences.
 */
export async function checkInbox(days = 30): Promise<InboxResult> {
  const cfg = imapConfig();
  if (!cfg) throw new Error("Configurazione IMAP incompleta (IMAP_HOST/PORT/USER/PASS in .env.local)");

  const sent = db
    .select({
      id: schema.messages.id,
      companyId: schema.messages.companyId,
      emailMessageId: schema.messages.emailMessageId,
      email: schema.contacts.email,
    })
    .from(schema.messages)
    .innerJoin(schema.contacts, eq(schema.contacts.id, schema.messages.contactId))
    .where(and(eq(schema.messages.status, "sent"), isNotNull(schema.messages.emailMessageId)))
    .all();

  const result: InboxResult = { scanned: 0, replied: 0, bounced: 0, unsubscribed: 0 };
  if (sent.length === 0) return result;

  const byMessageId = new Map(sent.map((s) => [s.emailMessageId!, s]));
  const byEmail = new Map<string, (typeof sent)[number]>();
  for (const s of sent) if (s.email) byEmail.set(s.email.toLowerCase(), s); // latest wins
  const seen = new Set(
    db
      .select({ id: schema.events.sourceMessageId })
      .from(schema.events)
      .where(isNotNull(schema.events.sourceMessageId))
      .all()
      .map((e) => e.id),
  );

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 993,
    doSTARTTLS: cfg.port !== 993,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: cfg.allowSelfSigned ? { rejectUnauthorized: false } : undefined,
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const since = new Date(Date.now() - days * 86_400_000);
    const uids = await client.search({ since }, { uid: true });
    if (!uids || uids.length === 0) return result;

    for await (const raw of client.fetch(uids, { source: true }, { uid: true })) {
      if (!raw.source) continue;
      result.scanned++;
      const mail = await simpleParser(raw.source);
      const sourceId = mail.messageId ?? `uid-${raw.uid}`;
      if (seen.has(sourceId)) continue;

      const from = addresses(mail.from)[0] ?? "";
      const subject = mail.subject ?? "";
      const body = mail.text ?? "";

      // Bounce: match any recipient address we wrote to that appears in the report
      if (BOUNCE_FROM_RE.test(from) || BOUNCE_SUBJECT_RE.test(subject)) {
        const hit = [...byEmail.entries()].find(([email]) => body.toLowerCase().includes(email));
        if (hit) {
          stopSequence(hit[1].companyId, hit[1].id, "bounced", sourceId);
          result.bounced++;
        }
        continue;
      }

      // Reply: thread headers first, then sender address
      const refs = [mail.inReplyTo, ...(Array.isArray(mail.references) ? mail.references : [mail.references])]
        .filter((r): r is string => Boolean(r));
      const match = refs.map((r) => byMessageId.get(r)).find(Boolean) ?? byEmail.get(from);
      if (!match) continue;

      // Only look at the new text, not the quoted original (which contains our opt-out line)
      const fresh = body.split(/\n(?:>|On .+wrote:|Il giorno .+ha scritto:|-{2,}\s*Original)/)[0];
      const type: EventType = UNSUBSCRIBE_RE.test(fresh) ? "unsubscribed" : "replied";
      stopSequence(match.companyId, match.id, type, sourceId);
      if (type === "unsubscribed") result.unsubscribed++;
      else result.replied++;
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return result;
}
