import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeRateLimit, rateLimit, resetRateLimits } from "./_core/rateLimit";
import { isTransitionAllowed } from "./orderTransitions";

afterEach(() => {
  resetRateLimits();
  vi.unstubAllEnvs();
});

describe("rate limiting (ETAPE 10 §9)", () => {
  it("consumeRateLimit allows max requests then blocks inside the window", () => {
    const opts = { windowMs: 60_000, max: 3 };
    expect(consumeRateLimit("test:bucket", "ip-1", opts)).toBe(true);
    expect(consumeRateLimit("test:bucket", "ip-1", opts)).toBe(true);
    expect(consumeRateLimit("test:bucket", "ip-1", opts)).toBe(true);
    expect(consumeRateLimit("test:bucket", "ip-1", opts)).toBe(false);
  });

  it("isolates buckets per key (per IP)", () => {
    const opts = { windowMs: 60_000, max: 1 };
    expect(consumeRateLimit("test:iso", "ip-a", opts)).toBe(true);
    expect(consumeRateLimit("test:iso", "ip-a", opts)).toBe(false);
    expect(consumeRateLimit("test:iso", "ip-b", opts)).toBe(true);
  });

  it("resets after the window expires", async () => {
    const opts = { windowMs: 20, max: 1 };
    expect(consumeRateLimit("test:window", "ip", opts)).toBe(true);
    expect(consumeRateLimit("test:window", "ip", opts)).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(consumeRateLimit("test:window", "ip", opts)).toBe(true);
  });

  it("express middleware rejects with 429 + Retry-After and never leaks internals", () => {
    const middleware = rateLimit("test:http", { windowMs: 60_000, max: 2 });
    const makeRes = () => {
      const res = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: null as unknown,
        setHeader(name: string, value: string) { res.headers[name] = value; },
        status(code: number) { res.statusCode = code; return res; },
        json(payload: unknown) { res.body = payload; return res; },
      };
      return res;
    };
    const req = { ip: "9.9.9.9", headers: {}, socket: {} } as never;
    let nextCount = 0;
    const next = () => { nextCount += 1; };
    middleware(req, makeRes() as never, next);
    middleware(req, makeRes() as never, next);
    const res = makeRes();
    middleware(req, res as never, next);
    expect(nextCount).toBe(2);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBeTruthy();
    expect(res.body).toEqual({ error: "Too many requests" });
  });
});

describe("order state machine (ETAPE 10 §10)", () => {
  it("allows the documented legal transitions", () => {
    expect(isTransitionAllowed("pending", "paid")).toBe(true);
    expect(isTransitionAllowed("pending", "failed")).toBe(true);
    expect(isTransitionAllowed("pending", "cancelled")).toBe(true);
    expect(isTransitionAllowed("paid", "refunded")).toBe(true);
  });

  it("forbids incoherent transitions (cancelled/refunded/paid can never go back)", () => {
    expect(isTransitionAllowed("cancelled", "paid")).toBe(false);
    expect(isTransitionAllowed("refunded", "paid")).toBe(false);
    expect(isTransitionAllowed("paid", "pending")).toBe(false);
    expect(isTransitionAllowed("paid", "cancelled")).toBe(false);
    expect(isTransitionAllowed("failed", "paid")).toBe(false);
    expect(isTransitionAllowed("pending", "refunded")).toBe(false);
  });
});

describe("private storage honored in every environment (ETAPE 10 §7)", () => {
  it("serves the private root even when NODE_ENV=production", async () => {
    const root = mkdtempSync(join(tmpdir(), "prod-storage-"));
    writeFileSync(join(root, "guide.pdf"), "premium-bytes");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PRIVATE_STORAGE_ROOT", root);
    const { storage } = await import("./storage");
    expect(await storage.exists("guide.pdf")).toBe(true);
    expect(await storage.exists("../outside.pdf")).toBe(false);
  });

  it("refuses everything when PRIVATE_STORAGE_ROOT is unset", async () => {
    vi.stubEnv("PRIVATE_STORAGE_ROOT", "");
    vi.resetModules();
    const { storage } = await import("./storage");
    expect(await storage.exists("anything.pdf")).toBe(false);
    await expect(
      storage.download("anything.pdf", { fileName: "x", mimeType: null, fileSize: null }),
    ).rejects.toThrow("Private storage is not configured");
    vi.resetModules();
  });
});

describe("environment audit (ETAPE 10 §1)", () => {
  const example = readFileSync(new URL("../.env.example", import.meta.url), "utf-8");

  it("exposes no secret-looking VITE_ variable to the frontend bundle", () => {
    const viteLines = example.split("\n").filter(line => line.startsWith("VITE_"));
    expect(viteLines.length).toBeGreaterThan(0);
    for (const line of viteLines) {
      const name = line.split("=")[0] ?? "";
      expect(name).not.toMatch(/KEY|SECRET|TOKEN/i);
    }
  });

  it("documents the removed VITE_FRONTEND_FORGE_* exposure", () => {
    expect(example).not.toMatch(/^VITE_FRONTEND_FORGE_API_KEY=/m);
    expect(example).not.toMatch(/^VITE_FRONTEND_FORGE_API_URL=/m);
  });

  it("server env module never reads a VITE_ secret", () => {
    const envSource = readFileSync(new URL("./_core/env.ts", import.meta.url), "utf-8");
    expect(envSource).not.toMatch(/VITE_.*KEY|VITE_.*SECRET/i);
  });
});
