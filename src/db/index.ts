import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "crm.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Reuse the connection across hot reloads in dev
const globalForDb = globalThis as unknown as { sqlite?: Database.Database };
const sqlite = globalForDb.sqlite ?? new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
if (process.env.NODE_ENV !== "production") globalForDb.sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };
