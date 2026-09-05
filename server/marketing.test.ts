import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("marketing procedures", () => {
  it("surfaces a database error for a valid newsletter signup when the database is unavailable", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.marketing.subscribe({ email: "reader@example.com" })).rejects.toThrow("Database connection is required");
  });

  it("rejects an invalid newsletter email", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.marketing.subscribe({ email: "not-an-email" })).rejects.toThrow();
  });

  it("surfaces a database error for a valid contact message when the database is unavailable", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.marketing.contact({ name: "A Reader", email: "reader@example.com", topic: "product", message: "I have a question about the guide." })).rejects.toThrow("Database connection is required");
  });

  it("rejects an empty contact message", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.marketing.contact({ name: "A Reader", email: "reader@example.com", topic: "product", message: "" })).rejects.toThrow();
  });
});
