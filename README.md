# Profit First Cashflow Tool

A 2-year (24-month) Profit First cashflow projection for builders & tradies.
Set opening balances + your PF percentages, enter expected monthly income, and
see the full month-by-month sweep across Income / BAS / Materials / Profit /
Owner's Pay / Tax / OpEx — with account graphs, min-balance reference lines,
BAS-lodgement + profit-distribution markers, and CSV export.

**Pure static site.** No server, no database, no login, no secrets. All data
lives in the browser (localStorage). Rebuilt from a Manus export — see
`docs/PHASE-2-XERO.md` for the parked Xero integration.

## Run locally

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # serve the built dist/
```

## Deploy

GitHub → Vercel. Vite preset, build `npm run build`, output `dist/`
(all set in `vercel.json`). Pushes to `main` auto-deploy.

## Branding

One brand per deployment, in `client/src/lib/brand.ts`. Currently **PFFT**
(navy `#1D4E79` / gold `#F5B944`, logo at `client/public/brand/`). To add
PFANZ/ETB later: add a `Brand` object and switch `BRAND`.

## Calculation engine

`client/src/lib/cashflow.ts` — unchanged from the original. BAS & Materials
sweep off **gross** income; Profit / Owner's Pay / Tax / OpEx are % of **Real
Revenue** (gross − BAS − Materials). Any unallocated remainder stays in Income.
