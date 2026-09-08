import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  fakeDb: null as unknown,
  fakeSession: null as
    | { id: string; payment_status: string; metadata: { orderId: string } }
    | undefined,
  executions: [] as Array<{ op: "delete" | "insert" | "update"; values?: unknown }>,
  currentConfig: {} as {
    orderRows?: Array<{ order: unknown }>;
    itemRows?: Array<{ item: unknown; asset: unknown }>;
    readRows?: Array<{ access: unknown; asset: unknown; order: unknown }>;
    claimAffected?: number;
  },
}));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => state.fakeDb),
  getAffectedRows: (result: unknown): number => {
    const header = (Array.isArray(result) ? result[0] : result) as { affectedRows?: unknown } | undefined;
    return Number(header?.affectedRows ?? 0);
  },
}));

vi.mock("stripe", () => ({
  default: class FakeStripe {
    readonly checkout = {
      sessions: {
        retrieve: vi.fn(async () => state.fakeSession),
      },
    };
  },
}));

// Must be stubbed BEFORE the downloads module is loaded: `_core/env.ts`
// snapshots process.env at import time.
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy_downloads");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dummy_downloads");

const { listDownloadAccess, downloadAsset } = await import("./downloads");

class FakeDbBuilder {
  private op = "";
  private cols: string[] = [];
  private valuesData: unknown;

  select(cols: Record<string, unknown>): this {
    this.op = "select";
    this.cols = Object.keys(cols);
    return this;
  }
  delete(): this {
    this.op = "delete";
    return this;
  }
  insert(): this {
    this.op = "insert";
    return this;
  }
  update(): this {
    this.op = "update";
    return this;
  }
  from(): this {
    return this;
  }
  innerJoin(): this {
    return this;
  }
  where(): this {
    return this;
  }
  limit(): this {
    return this;
  }
  set(): this {
    return this;
  }
  values(values: unknown): this {
    this.valuesData = values;
    return this;
  }

  private compute(): unknown {
    if (this.op === "select") {
      if (this.cols.includes("access")) return state.currentConfig.readRows ?? [];
      if (this.cols.includes("item")) return state.currentConfig.itemRows ?? [];
      return state.currentConfig.orderRows ?? [];
    }
    if (this.op === "delete") {
      state.executions.push({ op: "delete" });
      return [{ affectedRows: 1 }];
    }
    if (this.op === "insert") {
      state.executions.push({ op: "insert", values: this.valuesData });
      return [{ insertId: 1, affectedRows: 1 }];
    }
    if (this.op === "update") {
      state.executions.push({ op: "update" });
      return [{ affectedRows: state.currentConfig.claimAffected ?? 0 }];
    }
    return [];
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: (value: unknown) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.compute()).then(onfulfilled, onrejected);
  }
}

function makeDb() {
  return {
    select: (cols: Record<string, unknown>) => new FakeDbBuilder().select(cols),
    delete: () => new FakeDbBuilder().delete(),
    insert: () => new FakeDbBuilder().insert(),
    update: () => new FakeDbBuilder().update(),
  };
}

const PAID_ORDER = {
  order: { id: 1, customerId: 1, status: "paid", paymentStatus: "paid", currency: "USD", paymentReference: "cs_1" },
};

function assetRow(storageKey = "assets/guide.pdf"): { item: unknown; asset: unknown } {
  return {
    item: { id: 1, orderId: 1, productId: 4, productNameSnapshot: "Guide", unitPrice: "10.00", quantity: 1, total: "10.00", createdAt: new Date() },
    asset: { id: 7, productId: 4, fileName: "guide.pdf", storageKey, fileSize: 13, mimeType: "application/pdf", version: "1" },
  };
}

function readRow(): { access: unknown; asset: unknown; order: unknown } {
  return {
    access: { id: 1, orderId: 1, customerId: 1, productId: 4, assetId: 7, tokenHash: "a".repeat(64), downloadCount: 1, maxDownloads: 10, lastDownloadedAt: new Date(), expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
    asset: { id: 7, productId: 4, fileName: "guide.pdf", storageKey: "assets/guide.pdf", fileSize: 13, mimeType: "application/pdf", version: "1" },
    order: PAID_ORDER.order,
  };
}

let tmpRoot = "";

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "pay-grants-"));
  mkdirSync(join(tmpRoot, "assets"), { recursive: true });
  writeFileSync(join(tmpRoot, "assets", "guide.pdf"), "PREMIUM-BYTES");
  vi.stubEnv("PRIVATE_STORAGE_ROOT", tmpRoot);

  state.executions = [];
  state.currentConfig = {};
  state.fakeDb = makeDb();
  state.fakeSession = { id: "cs_test_dl", payment_status: "paid", metadata: { orderId: "1" } };
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("download access grants", () => {
  it("issues exactly one secure grant per asset for a paid order", async () => {
    state.currentConfig = { orderRows: [PAID_ORDER], itemRows: [assetRow()] };
    const result = await listDownloadAccess("cs_test_dl");

    expect(result.orderId).toBe(1);
    expect(result.access).toHaveLength(1);
    const grant = result.access[0]!;
    expect(grant.fileName).toBe("guide.pdf");
    expect(grant.expiresAt).toBeDefined();
    const rawToken = grant.url.split("/").pop()!;
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);

    // The database stores the SHA-256 hash, never the raw token, and a
    // revoke (delete) precedes the insert so only ONE grant stays active.
    const ops = state.executions.filter(e => e.op === "delete" || e.op === "insert");
    expect(ops.map(e => e.op)).toEqual(["delete", "insert"]);
    const stored = (ops[1] as { values: { tokenHash: string } }).values.tokenHash;
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
    expect(stored).not.toBe(rawToken);
  });

  it("keeps a single active grant across repeated success-page visits", async () => {
    state.currentConfig = { orderRows: [PAID_ORDER], itemRows: [assetRow()] };
    const first = await listDownloadAccess("cs_test_dl");
    const second = await listDownloadAccess("cs_test_dl");

    expect(first.access).toHaveLength(1);
    expect(second.access).toHaveLength(1);
    expect(second.access[0]!.url).not.toBe(first.access[0]!.url);

    const ops = state.executions
      .filter(e => e.op === "delete" || e.op === "insert")
      .map(e => e.op);
    // visit 1: revoke -> insert ; visit 2: revoke -> insert. Never two live grants.
    expect(ops).toEqual(["delete", "insert", "delete", "insert"]);
  });

  it("returns a controlled error when the digital asset is missing", async () => {
    state.currentConfig = { orderRows: [PAID_ORDER], itemRows: [assetRow("assets/gone.pdf")] };
    await expect(listDownloadAccess("cs_test_dl")).rejects.toThrow("Digital asset is unavailable");
  });

  it("stays pending when the webhook has not marked the order paid yet", async () => {
    state.currentConfig = { orderRows: [], itemRows: [assetRow()] };
    await expect(listDownloadAccess("cs_test_dl")).rejects.toThrow("Payment is still being confirmed");
  });

  it("refuses access when the Stripe session is not paid", async () => {
    state.fakeSession = { id: "cs_test_dl", payment_status: "unpaid", metadata: { orderId: "1" } };
    state.currentConfig = { orderRows: [PAID_ORDER], itemRows: [assetRow()] };
    await expect(listDownloadAccess("cs_test_dl")).rejects.toThrow("Payment is not confirmed");
  });

  it("never prints the raw download token in any log", async () => {
    state.currentConfig = { orderRows: [PAID_ORDER], itemRows: [assetRow()] };
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await listDownloadAccess("cs_test_dl");
      const rawToken = result.access[0]!.url.split("/").pop()!;
      const allLogs = [...info.mock.calls, ...error.mock.calls].map(call => JSON.stringify(call)).join("\n");
      expect(allLogs).not.toContain(rawToken);
    } finally {
      info.mockRestore();
      error.mockRestore();
    }
  });
});

describe("downloadAsset (secure download endpoint)", () => {
  const token = "a".repeat(64);

  it("streams the private file for a paid order with an unexpired, non-exhausted grant", async () => {
    state.currentConfig = { claimAffected: 1, readRows: [readRow()] };
    const file = await downloadAsset(token);
    expect(file.fileName).toBe("guide.pdf");
    expect(file.mimeType).toBe("application/pdf");
    const chunks: Buffer[] = [];
    for await (const chunk of file.stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString("utf8")).toBe("PREMIUM-BYTES");
  });

  it("refuses a download for an expired or exhausted grant", async () => {
    state.currentConfig = { claimAffected: 0 };
    await expect(downloadAsset(token)).rejects.toThrow("Download access is invalid or expired");
  });

  it("refuses a download when the order is no longer paid", async () => {
    state.currentConfig = { claimAffected: 1, readRows: [] };
    await expect(downloadAsset(token)).rejects.toThrow("Download access is invalid or expired");
  });

  it("refuses an empty or oversized token before touching the database", async () => {
    await expect(downloadAsset("")).rejects.toThrow("invalid or expired");
    await expect(downloadAsset("x".repeat(600))).rejects.toThrow("invalid or expired");
  });
});