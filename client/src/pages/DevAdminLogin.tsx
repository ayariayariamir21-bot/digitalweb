import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";

export default function DevAdminLogin() {
  const [, navigate] = useLocation();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/dev/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Login failed");
      navigate("/admin");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="container section-pad">
      <div className="mx-auto max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <p className="eyebrow"><span className="eyebrow-line" />Development only</p>
        <h1 className="mt-3 text-3xl font-semibold">Local admin login</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This endpoint exists only while NODE_ENV is development. Never use it in production.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium" htmlFor="dev-admin-key">
            Development admin key
          </label>
          <input
            id="dev-admin-key"
            type="password"
            autoComplete="off"
            value={key}
            onChange={event => setKey(event.target.value)}
            className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-slate-900"
            required
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="button button-primary w-full justify-center">
            {isSubmitting ? "Signing in…" : "Open admin dashboard"}
          </button>
        </form>

        <Link href="/" className="mt-6 inline-block text-sm text-muted-foreground hover:text-slate-900">
          Back to store
        </Link>
      </div>
    </main>
  );
}
