import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DRIZZLE_DIR = join(__dirname, "..", "drizzle");

type JournalEntry = { idx: number; tag: string; breakpoints: boolean; when: number };

function loadJournal(): JournalEntry[] {
  const raw = readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8");
  return (JSON.parse(raw) as { entries: JournalEntry[] }).entries;
}

/**
 * Counts top-level SQL statements in a migration chunk, ignoring semicolons
 * inside single-quoted string literals (and '' escapes) and comments.
 *
 * Mirrors the failure mode of ETAPE 11: drizzle's mysql2 migrator executes
 * every `--> statement-breakpoint` chunk with ONE driver query
 * (mysql2 has `multipleStatements` disabled), so any chunk holding two
 * statements aborts a fresh `drizzle-kit migrate` with ER_PARSE_ERROR.
 */
export function countTopLevelStatements(chunk: string): number {
  let count = 0;
  let seen = false;
  let inString = false;
  let inLineComment = false;
  for (let i = 0; i < chunk.length; i++) {
    const char = chunk[i];
    const next = chunk[i + 1];
    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (inString) {
      if (char === "'" && next === "'") {
        i++;
        continue;
      }
      if (char === "'") inString = false;
      continue;
    }
    if (char === "-" && next === "-") {
      inLineComment = true;
      i++;
      continue;
    }
    if (char === "'") {
      inString = true;
      seen = true;
      continue;
    }
    if (char === ";") {
      if (seen) count++;
      seen = false;
      continue;
    }
    if (!/\s/.test(char)) seen = true;
  }
  if (seen) count++;
  return count;
}

describe("drizzle migrations (ETAPE 11 regression)", () => {
  it("journal entries are ordered and every tag has a matching .sql file", () => {
    const entries = loadJournal();
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((entry, index) => {
      expect(entry.idx).toBe(index);
      const files = readdirSync(DRIZZLE_DIR);
      expect(files).toContain(`${entry.tag}.sql`);
    });
    const tags = entries.map(entry => entry.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("every breakpoint chunk holds at most one statement (fresh migrate safe)", () => {
    for (const entry of loadJournal()) {
      const content = readFileSync(join(DRIZZLE_DIR, `${entry.tag}.sql`), "utf8");
      // Exact split used by drizzle-orm's readMigrationFiles().
      const chunks = content.split("--> statement-breakpoint");
      for (const [index, chunk] of chunks.entries()) {
        const statements = countTopLevelStatements(chunk);
        expect(
          statements,
          `${entry.tag}.sql chunk #${index} holds ${statements} statements; a fresh migrate would fail with ER_PARSE_ERROR`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("multi-statement migrations declare their breakpoints explicitly", () => {
    for (const entry of loadJournal()) {
      if (!entry.breakpoints) continue;
      const content = readFileSync(join(DRIZZLE_DIR, `${entry.tag}.sql`), "utf8");
      const chunks = content.split("--> statement-breakpoint");
      const total = chunks.reduce((sum, chunk) => sum + countTopLevelStatements(chunk), 0);
      expect(chunks.length).toBe(total);
    }
  });
});
