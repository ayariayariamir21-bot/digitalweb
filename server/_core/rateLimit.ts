import type { NextFunction, Request, Response } from "express";

export type RateLimitOptions = {
  /** Sliding window in milliseconds. */
  windowMs: number;
  /** Max requests per key inside the window. */
  max: number;
  /** Value returned in the Retry-After header on 429 (seconds). */
  retryAfterSeconds?: number;
  /** Stable bucket key. Defaults to client IP. */
  key?: (req: Request) => string;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || req.ip || "unknown";
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/** Clears all in-memory buckets. Exported for tests. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * Minimal in-memory sliding-window rate limiter (no dependency).
 * Suitable for a single Node process. Behind multiple replicas, use a
 * shared store (Redis) — documented in docs/production-readiness.md.
 */
export function rateLimit(prefix: string, options: RateLimitOptions) {
  const keyOf = options.key ?? clientIp;
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const bucketKey = `${prefix}:${keyOf(req)}`;
    const current = buckets.get(bucketKey);
    if (!current || current.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    current.count += 1;
    if (current.count > options.max) {
      res.setHeader("Retry-After", String(options.retryAfterSeconds ?? Math.ceil(options.windowMs / 1000)));
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    next();
  };
}

/** Consumes one token for a non-Express caller (tRPC). Returns true if allowed. */
export function consumeRateLimit(prefix: string, key: string, options: { windowMs: number; max: number }): boolean {
  const now = Date.now();
  const bucketKey = `${prefix}:${key}`;
  const current = buckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= options.max;
}

/** Periodic cleanup so the map cannot grow unboundedly. */
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) buckets.delete(key);
    });
  }, 60_000);
  // Never keep the process alive for this housekeeping timer (tests/CI).
  (timer as unknown as { unref?: () => void }).unref?.();
}
