import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Company, Contact, Message, Settings } from "@/db/schema";

export type ReviewItem = {
  company: Company;
  contact: Contact | null;
  messages: Message[];
};

export function getSettings(): Settings {
  const row = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();
  if (row) return row;
  return db.insert(schema.settings).values({ id: 1 }).returning().get();
}

export function primaryContact(companyId: number): Contact | null {
  return (
    db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.companyId, companyId))
      .orderBy(asc(schema.contacts.id))
      .get() ?? null
  );
}

export function companyMessages(companyId: number): Message[] {
  return db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.companyId, companyId))
    .orderBy(asc(schema.messages.step))
    .all();
}

/** Companies waiting for review: "review" first, then "new" (still to enrich). */
export function getReviewQueue(): ReviewItem[] {
  const list = db
    .select()
    .from(schema.companies)
    .where(inArray(schema.companies.status, ["review", "new"]))
    .orderBy(
      sql`CASE ${schema.companies.status} WHEN 'review' THEN 0 ELSE 1 END`,
      asc(schema.companies.id),
    )
    .all();
  return list.map((company) => ({
    company,
    contact: primaryContact(company.id),
    messages: companyMessages(company.id),
  }));
}

export function getCompaniesWithContacts() {
  const list = db.select().from(schema.companies).orderBy(asc(schema.companies.id)).all();
  return list.map((company) => ({ company, contact: primaryContact(company.id) }));
}

export function statusCounts(): Record<string, number> {
  const rows = db
    .select({ status: schema.companies.status, n: sql<number>`count(*)` })
    .from(schema.companies)
    .groupBy(schema.companies.status)
    .all();
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export type QueueRow = {
  id: number;
  step: number;
  status: string;
  subject: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  manualSchedule: boolean;
  companyId: number;
  companyName: string;
  email: string | null;
};

function queueSelect() {
  return db
    .select({
      id: schema.messages.id,
      step: schema.messages.step,
      status: schema.messages.status,
      subject: schema.messages.subject,
      scheduledAt: schema.messages.scheduledAt,
      sentAt: schema.messages.sentAt,
      manualSchedule: schema.messages.manualSchedule,
      companyId: schema.companies.id,
      companyName: schema.companies.name,
      email: schema.contacts.email,
    })
    .from(schema.messages)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.messages.companyId))
    .leftJoin(schema.contacts, eq(schema.contacts.id, schema.messages.contactId));
}

export function getQueue() {
  const scheduled = queueSelect()
    .where(eq(schema.messages.status, "scheduled"))
    .orderBy(asc(schema.messages.scheduledAt))
    .all();
  // Approved follow-ups waiting for the previous step to be sent
  const waiting = queueSelect()
    .where(eq(schema.messages.status, "approved"))
    .orderBy(asc(schema.companies.id), asc(schema.messages.step))
    .all();
  const sent = queueSelect()
    .where(eq(schema.messages.status, "sent"))
    .orderBy(desc(schema.messages.sentAt))
    .limit(30)
    .all();
  return { scheduled, waiting, sent };
}

export function getLeadSearches() {
  return db.select().from(schema.leadSearches).orderBy(desc(schema.leadSearches.id)).limit(10).all();
}

export function getLeads() {
  const list = db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.status, "lead"))
    .orderBy(desc(schema.companies.searchId), asc(schema.companies.id))
    .all();
  return list.map((company) => ({ company, contact: primaryContact(company.id) }));
}
