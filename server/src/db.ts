import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "./config.js";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = resolve(__dirname, "../migrations");

export const db = new Database(config.databaseFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/** Apply migrations idempotently. */
export function applyMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set<string>(
    (db.prepare(`SELECT id FROM _migrations`).all() as Array<{ id: string }>).map((r) => r.id),
  );

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare(`INSERT INTO _migrations (id, applied_at) VALUES (?, ?)`).run(
        file,
        new Date().toISOString(),
      );
    });
    tx();
    logger.info("migration applied", { file });
  }
}
