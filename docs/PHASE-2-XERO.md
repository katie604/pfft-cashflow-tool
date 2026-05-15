# Phase 2 — Add Xero back (parked)

The original Manus export had a third tab, **Historical (Xero)**: connect Xero,
pull 2 years of real bank data, year-on-year comparison, 3-month forecast with
editable per-supplier projections. It was removed for the static rebuild because
it's the *only* reason the app needs a server, a database, and secrets.

## What was stripped (recoverable from the Manus export)

Source export: `~/Downloads/pfft-cashflow-tool/` (keep it).

| Piece | Original file(s) |
|-------|------------------|
| Xero OAuth + data endpoints | `server/xeroRouter.ts`, `server/xeroCallback.ts` |
| Token + mapping storage | `drizzle/schema.ts` (`xeroSettings`, `xeroAccountMappings`) |
| DB layer | `server/db.ts`, `server/storage.ts`, `drizzle.config.ts` |
| Frontend tab | `client/src/components/XeroHistorical.tsx` (1325 lines) |
| API plumbing | `client/src/lib/trpc.ts`, tRPC deps |

## What adding it back requires

1. **A Xero developer app** (developer.xero.com) — client id + secret, redirect
   URI `https://<domain>/api/xero/callback`. Scopes: `openid profile email
   accounting.banktransactions.read accounting.settings.read offline_access`.
2. **A database** — original used MySQL/Drizzle. For Vercel, switch the Drizzle
   dialect to **Vercel Postgres** (only 3 tables; trivial migration).
3. **Serverless API** — port `xeroRouter.ts` + `xeroCallback.ts` to Vercel
   serverless functions (or a small separate API service). Token auto-refresh
   logic is in `getRefreshedXero` in the original `xeroRouter.ts`.
4. **Secrets in Vercel env**: `XeroClientID`, `ClientSecret1`,
   `XERO_REDIRECT_URI`, `DATABASE_URL`, `JWT_SECRET`. Apply the repo's
   `.claude/rules/git-safety.md` proxy-auth checklist.

## ⚠️ The architectural blocker to solve first

The original is **single-tenant**: one `xeroSettings` row = one connected Xero
org for the whole app. That clashes directly with Katie's goal of using this
**across many clients / all businesses**. Before rebuilding Xero, decide the
multi-org model:

- **Per-session connect** (no stored tokens; user connects their Xero each
  visit) — simplest, no real DB, best for a lead/coaching tool.
- **Per-user accounts** (login → each user stores their own Xero tokens) —
  proper multi-tenant, more infra.

Don't port the single-org design as-is. That's the real phase-2 work, not the
plumbing.
