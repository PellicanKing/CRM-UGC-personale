import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`);

export const COMPANY_STATUSES = [
  "lead",
  "new",
  "review",
  "approved",
  "contacted",
  "replied",
  "discarded",
] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const MESSAGE_STATUSES = [
  "draft",
  "approved",
  "scheduled",
  "sent",
  "cancelled",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const EVENT_TYPES = [
  "sent",
  "opened",
  "replied",
  "bounced",
  "unsubscribed",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  website: text("website"),
  sector: text("sector"),
  city: text("city"),
  instagram: text("instagram"),
  tiktok: text("tiktok"),
  facebookPage: text("facebook_page"),
  adLibraryUrl: text("ad_library_url"),
  summary: text("summary"),
  target: text("target"),
  weaknesses: text("weaknesses"),
  hook: text("hook"),
  // Ready-to-copy Instagram DM (never sent automatically)
  dmText: text("dm_text"),
  status: text("status", { enum: COMPANY_STATUSES }).notNull().default("new"),
  // "utente" = given by the user, "ai" = found by the lead search
  origin: text("origin"),
  // Why the AI thinks this company is similar / a good fit
  leadReason: text("lead_reason"),
  searchId: integer("search_id"),
  createdAt: createdAt(),
});

export const LEAD_SEARCH_STATUSES = ["running", "done", "error"] as const;

export const leadSearches = sqliteTable("lead_searches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  seeds: text("seeds").notNull(),
  notes: text("notes"),
  count: integer("count").notNull(),
  status: text("status", { enum: LEAD_SEARCH_STATUSES }).notNull().default("running"),
  error: text("error"),
  found: integer("found").notNull().default(0),
  createdAt: createdAt(),
});

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name"),
  role: text("role"),
  email: text("email"),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  source: text("source"),
  createdAt: createdAt(),
});

export const sequences = sqliteTable("sequences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // Days to wait before each step, e.g. [0, 3, 7]
  steps: text("steps", { mode: "json" }).$type<number[]>().notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  // 0 = first message, 1 = follow-up 1, 2 = follow-up 2
  step: integer("step").notNull(),
  subject: text("subject"),
  aiDraft: text("ai_draft"),
  finalText: text("final_text"),
  status: text("status", { enum: MESSAGE_STATUSES }).notNull().default("draft"),
  // UTC ISO timestamp
  scheduledAt: text("scheduled_at"),
  // True when the user moved this send by hand: the planner won't touch it
  manualSchedule: integer("manual_schedule", { mode: "boolean" }).notNull().default(false),
  sentAt: text("sent_at"),
  // RFC 5322 Message-ID of the sent email, used to match replies
  emailMessageId: text("email_message_id"),
  createdAt: createdAt(),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  type: text("type", { enum: EVENT_TYPES }).notNull(),
  // Message-ID of the incoming email that produced the event (dedupe)
  sourceMessageId: text("source_message_id"),
  timestamp: createdAt(),
});

export const settings = sqliteTable("settings", {
  // Single-row table (id = 1)
  id: integer("id").primaryKey(),
  // ISO weekdays allowed for sending, 1 = Monday ... 7 = Sunday
  sendDays: text("send_days", { mode: "json" })
    .$type<number[]>()
    .notNull()
    .default(sql`'[2]'`),
  windowStart: text("window_start").notNull().default("07:30"),
  windowEnd: text("window_end").notNull().default("12:00"),
  timezone: text("timezone").notNull().default("Europe/Rome"),
  dailyLimit: integer("daily_limit").notNull().default(20),
  minIntervalMin: integer("min_interval_min").notNull().default(2),
  maxIntervalMin: integer("max_interval_min").notNull().default(6),
  // Days to wait after the previous message of the sequence was sent
  followupDays: text("followup_days", { mode: "json" })
    .$type<number[]>()
    .notNull()
    .default(sql`'[7,15]'`),
  // Global switch: the scheduler sends nothing while this is off
  sendingEnabled: integer("sending_enabled", { mode: "boolean" }).notNull().default(false),
  signature: text("signature").notNull().default(""),
  // Email templates per step (null = built-in default). Placeholders: {{nome}}, {{azienda}}, {{personalizzazione}}
  templates: text("templates", { mode: "json" }).$type<string[]>(),
  // Writing style learned from the user's edits
  learnedStyle: text("learned_style"),
  // Highest message id already used to learn the style
  styleLastMessageId: integer("style_last_message_id"),
  unsubscribeText: text("unsubscribe_text")
    .notNull()
    .default(
      "Se preferisci non ricevere altri messaggi, rispondi con «no grazie» e non ti scriverò più.",
    ),
});

export type Company = typeof companies.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type LeadSearch = typeof leadSearches.$inferSelect;
