import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
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
