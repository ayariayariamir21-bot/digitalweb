import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "../payments";
import { downloadAsset } from "../downloads";
import { rateLimit } from "./rateLimit";
import { COOKIE_NAME } from "@shared/const";
import { ENV, requireEnv } from "./env";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { upsertUser } from "../db";
import { timingSafeEqual } from "node:crypto";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  console.info("[Storage] Private storage configured", {
    configured: Boolean(ENV.privateStorageRoot.trim()),
  });
  // Health check (no DB/Stripe dependency, safe for load balancers).
  // Liveness only: readiness with real dependencies is documented in
  // docs/production-readiness.md.
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  // ETAPE 10 rate limits (see docs/production-readiness.md):
  // - webhook: generous (300/min/IP) so Stripe bursts + redeliveries are
  //   never broken by a naive limit. Signature verification stays the real
  //   protection; abuse without a valid signature is rejected at low cost.
  // - download: 60/min/IP to slow token brute-force without hurting
  //   legitimate sequential downloads.
  app.post(
    "/api/stripe/webhook",
    rateLimit("http:stripe-webhook", { windowMs: 60_000, max: 300 }),
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      try {
        const signature = req.headers["stripe-signature"];
        await handleStripeWebhook(req.body as Buffer, typeof signature === "string" ? signature : undefined);
        res.json({ received: true });
      } catch (error) {
        console.error("[Stripe] Webhook rejected:", error instanceof Error ? error.message : error);
        res.status(400).json({ error: "Invalid webhook" });
      }
    }
  );
  app.get("/api/download/:token",
    rateLimit("http:download", { windowMs: 60_000, max: 60 }),
    async (req, res) => {
    try {
      const file = await downloadAsset(req.params.token);
      if (file.mimeType) res.type(file.mimeType);
      if (file.fileSize !== null) res.setHeader("Content-Length", file.fileSize);
      res.setHeader("Content-Disposition", `attachment; filename="${file.fileName.replace(/["\r\n]/g, "")}"`);
      file.stream.on("error", error => {
        console.error("[Downloads] Streaming failed:", error instanceof Error ? error.message : error);
        if (!res.headersSent) res.status(500).end();
      });
      file.stream.pipe(res);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Download unavailable" });
    }
  });
  // Minimal security headers (no new dependency). The API is same-origin;
  // no CORS middleware is registered on purpose.
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    // HSTS only in production over HTTPS. Never force it in development
    // (localhost is HTTP and would be bricked by a cached HSTS policy).
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
  // Configure body parser with a tight limit: the largest legitimate JSON
  // payloads here are product/contact forms (a few KB). The Stripe webhook
  // above intentionally keeps its raw body and is unaffected.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.post("/api/dev/admin-login", async (req, res) => {
    if (ENV.isProduction) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const configuredKey = ENV.devAdminKey;
    const submittedKey = typeof req.body?.key === "string" ? req.body.key : "";
    if (!configuredKey || !submittedKey) {
      res.status(401).json({ error: "Invalid development credentials" });
      return;
    }

    const expected = Buffer.from(configuredKey, "utf8");
    const received = Buffer.from(submittedKey, "utf8");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      res.status(401).json({ error: "Invalid development credentials" });
      return;
    }

    try {
      const openId = "local-dev-admin";
      await upsertUser({
        openId,
        name: "Local Development Admin",
        email: "local-admin@example.test",
        loginMethod: "local-development",
        role: "admin",
        lastSignedIn: new Date(),
      });
      const sessionToken = await sdk.signSession({
        openId,
        appId: "local-development",
        name: "Local Development Admin",
      }, { expiresInMs: 8 * 60 * 60 * 1000 });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        sameSite: "lax",
        secure: false,
        maxAge: 8 * 60 * 60 * 1000,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[DevAuth] Login failed:", error instanceof Error ? error.message : error);
      res.status(500).json({ error: "Development login unavailable" });
    }
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Startup diagnostics — boolean flags only, never the secret values.
  // `stripe listen --forward-to` MUST target this exact URL/port, otherwise
  // webhooks silently never reach this server and success pages hang on
  // "Payment is still being confirmed".
  const stripeSecretConfigured = Boolean(ENV.stripeSecretKey.trim());
  const webhookSecretConfigured = Boolean(ENV.stripeWebhookSecret.trim());
  const webhookPath = "/api/stripe/webhook";
  const webhookUrl = `http://localhost:${port}${webhookPath}`;
  console.info("[Stripe] Startup diagnostics (no secret values shown)");
  console.info(`  HTTP port used ................. : ${port}`);
  console.info(`  STRIPE_SECRET_KEY configured ... : ${stripeSecretConfigured}`);
  console.info(`  STRIPE_WEBHOOK_SECRET set ...... : ${webhookSecretConfigured}`);
  console.info(`  Stripe webhook URL ............. : ${webhookUrl}`);
  console.info(`  Webhook route mounted before JSON middleware : true (raw body)`);
  console.info(`  NODE_ENV ....................... : ${process.env.NODE_ENV ?? "unset"}`);
  if (!stripeSecretConfigured) {
    console.error("[Stripe] ERROR: STRIPE_SECRET_KEY is not configured. Creating checkout sessions and verifying webhooks will fail until it is added to .env (then restart the server).");
  }
  if (!webhookSecretConfigured) {
    console.error(`[Stripe] ERROR: STRIPE_WEBHOOK_SECRET is not configured. Webhook requests will be rejected with HTTP 400. Run \`stripe listen --forward-to ${webhookUrl}\` and copy the whsec_ value into .env (then restart the server).`);
  }
  console.info(`[Stripe] Keep Stripe CLI forwarding to: ${webhookUrl}`);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
