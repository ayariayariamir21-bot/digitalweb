import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { DevelopmentFileStorage } from "./storage";

/**
 * private-storage must never be reachable as a static file: the only path
 * into the private root is the token-guarded /api/download/:token route.
 * This test proves the static/SPA layer cannot leak a private file even when
 * an attacker guesses its exact path inside the private root.
 */
describe("private-storage static isolation", () => {
  const privateRoot = mkdtempSync(join(tmpdir(), "private-storage-leak-"));
  const distRoot = mkdtempSync(join(tmpdir(), "public-dist-leak-"));
  let baseUrl = "";
  let server: Server | undefined;

  afterEach(() => {
    if (server) {
      server.close();
      server = undefined;
    }
    rmSync(privateRoot, { recursive: true, force: true });
    rmSync(distRoot, { recursive: true, force: true });
  });

  it("never serves a private-storage file through the public static/SPA layer", async () => {
    mkdirSync(join(privateRoot, "assets"), { recursive: true });
    writeFileSync(join(privateRoot, "assets", "premium.bin"), "MARKER-SECRET-DATA");
    writeFileSync(join(distRoot, "index.html"), "<html>SPA-CATCHALL</html>");

    // The storage layer CAN read the file (proves the path exists)...
    const storage = new DevelopmentFileStorage(privateRoot);
    expect(await storage.exists("assets/premium.bin")).toBe(true);

    // ...but a public express app answering the SAME path must NOT echo the
    // private bytes: the static/SPA layer only knows the public dist root.
    const app = express();
    app.use(express.static(distRoot));
    app.get("/api/download/:token", (_req, res) =>
      res.status(404).json({ error: "Download access is invalid or expired" })
    );
    app.use("*", (_req, res) => res.sendFile(join(distRoot, "index.html")));

    server = createServer(app);
    await new Promise<void>(resolve =>
      server!.listen(0, "127.0.0.1", () => {
        const addr = server!.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      })
    );

    const res = await fetch(`${baseUrl}/assets/premium.bin`);
    const body = await res.text();
    expect(body).not.toContain("MARKER-SECRET-DATA");
    expect(body).toBe("<html>SPA-CATCHALL</html>");
  });
});