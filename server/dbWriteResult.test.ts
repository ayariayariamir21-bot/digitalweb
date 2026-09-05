import { describe, expect, it } from "vitest";
import { getAffectedRows, getInsertId } from "./db";

/**
 * ETAPE 11 regression: drizzle-orm's mysql2 session returns the RAW driver
 * result for writes (`[header, fields]`), so `insertId`/`affectedRows` must
 * be read from element `[0]`. Reading them directly off the result object
 * yields `undefined` (NaN ids, impossible order creation, every download
 * rejected) — a bug invisible to all offline tests because they never open
 * a database connection.
 */
describe("mysql2 write-result helpers", () => {
  it("reads insertId from the mysql2 tuple shape", () => {
    expect(getInsertId([{ insertId: 42 }, []])).toBe(42);
  });

  it("reads insertId from a plain header object", () => {
    expect(getInsertId({ insertId: 7 })).toBe(7);
  });

  it("returns NaN when no insert id is available", () => {
    expect(getInsertId([{}, []])).toBeNaN();
    expect(getInsertId(undefined)).toBeNaN();
  });

  it("reads affectedRows from the mysql2 tuple shape", () => {
    expect(getAffectedRows([{ affectedRows: 1 }, []])).toBe(1);
    expect(getAffectedRows([{ affectedRows: 0 }, []])).toBe(0);
  });

  it("reads affectedRows from a plain header object", () => {
    expect(getAffectedRows({ affectedRows: 3 })).toBe(3);
  });

  it("never mistakes a failed update for a consumed download (0 !== 1)", () => {
    expect(getAffectedRows([{ affectedRows: 0 }, []])).not.toBe(1);
  });
});
