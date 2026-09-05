# Stripe test setup

1. Create a Stripe account and use test mode.
2. Copy the test secret key to `STRIPE_SECRET_KEY` in the local `.env` file.
3. Set `APP_URL` to the URL used by the browser, for example `http://localhost:3000`.
4. Start the application with `pnpm dev`.
5. Forward Stripe events to the local webhook endpoint:

```text
POST /api/stripe/webhook
```

Use the Stripe CLI to obtain a test webhook signing secret and set it as
`STRIPE_WEBHOOK_SECRET`. Never put either secret in `.env.example`, source
control, frontend code, tests, or logs.

The checkout session is created from the stored order and order-item snapshots.
The browser cannot provide prices or mark an order as paid. Orders become
`paid` only after a verified Stripe webhook event.

## Private downloads

Digital files are not stored in the repository or public web directories.
For local development only, set `PRIVATE_STORAGE_ROOT` to a private folder
containing files whose paths match each asset's internal `storageKey`.
Production requires replacing the storage adapter with a private object-storage
implementation. When no private storage is configured, downloads are refused.
