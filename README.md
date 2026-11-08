# CediX — Crypto Trading Platform for Ghana 🇬🇭

A full-stack crypto exchange tailored for the Ghanaian market: spot trading with live market data,
GH₵ deposits & direct fiat withdrawals via **Payteller**, P2P marketplace, the **Orbit** community with
AI-driven fraud moderation, staking/savings products, a full admin dashboard — plus a dedicated
**mobile app (PWA)** with its own mobile-first interface.

## Quick start

```bash
npm install
npm run dev        # starts embedded PostgreSQL + Next.js on http://localhost:3000
```

First-time setup (already done in this workspace):

```bash
npm run db:start                  # init + start embedded PostgreSQL (port 5433)
npx prisma migrate dev            # create schema
npm run db:seed                   # seed admin/demo users, products, offers, settings
```

### Demo accounts

| Role  | Email            | Password  |
| ----- | ---------------- | --------- |
| Admin | admin@cedix.gh   | Admin123! |
| User  | demo@cedix.gh    | Demo123!  |

## Apps & URLs

| Surface              | URL                  | Notes                                             |
| -------------------- | -------------------- | ------------------------------------------------- |
| Desktop web          | `/`                  | OKX-style layout, portfolio in USD + GH₵          |
| Markets              | `/markets`           | Favorites / Crypto / New / Stocks / ETFs tabs, Spot ⇄ Futures toggle |
| Spot trading         | `/trade/BTCUSDT`     | Live chart, order book, market trades, market & limit orders |
| Deposit (GH₵)        | `/deposit`           | Crypto selection → conversion quote → Payteller checkout |
| Fiat withdrawal      | `/withdraw`          | Any crypto → GH₵ to MoMo/bank in one step (no sell required) |
| P2P marketplace      | `/p2p`               | Escrow-protected offers & order lifecycle         |
| Orbit community      | `/orbit`             | Posts with images/video, likes, comments, AI moderation |
| Explore (Earn)       | `/explore`           | Staking & savings products with live accrual      |
| Admin dashboard      | `/admin`             | Users, finance, Orbit content, moderation queue, settings, audit log |
| **Mobile app (PWA)** | `/m`                 | Unique mobile UI, bottom tabs, installable (manifest + service worker). Phone user-agents hitting `/` are redirected automatically. |

## Architecture

- **Next.js 16** (App Router, Turbopack, Cache Components) + TypeScript + Tailwind v4
- **PostgreSQL** via Prisma 7 (`@prisma/adapter-pg`). Dev uses an embedded Postgres
  (`scripts/db.mjs`, data in `.pgdata/`); production only needs a different `DATABASE_URL`.
- **Market data**: live Binance public REST (tickers, klines, depth, trades) + WebSocket on the
  client; tokenized stocks/ETFs are simulated until a stock data provider is configured.
- **FX (USD→GHS)**: live rate from open.er-api.com with an admin-configurable margin, or a full
  admin override (Admin → Settings).
- **Payments**: `src/lib/payteller.ts` abstracts the Payteller gateway. Without credentials it runs
  in **sandbox mode** with a simulated hosted checkout at `/pay/sandbox/[ref]` and instant payouts.
  Set `PAYTELLER_BASE_URL`, `PAYTELLER_API_KEY`, `PAYTELLER_MERCHANT_ID` to go live — the webhook
  endpoint is `POST /api/payteller/webhook`.
- **Trading engine**: `src/lib/trading.ts` — market orders fill at live price; limit orders lock
  funds and are matched against live prices by a background loop (`src/instrumentation.ts`).
- **AI moderation**: `src/lib/moderation.ts` scores every Orbit post/comment (scam patterns,
  payment solicitation, phishing, velocity). ≥60 → auto-removed + strike, 3 strikes → auto-block
  from Orbit; 35–59 → flagged for the admin review queue.
- **Auth**: JWT (jose) in an httpOnly cookie, bcrypt password hashing, USER/ADMIN roles.

## Useful scripts

```bash
npm run dev          # db + dev server
npm run build        # production build
npm run start        # db + production server
npm run db:start     # start embedded PostgreSQL
npm run db:stop      # stop embedded PostgreSQL
npm run db:migrate   # prisma migrate dev
npm run db:seed      # reseed demo data
```

> **Note (Windows):** the embedded Postgres binaries need the MSVC runtime DLLs. These were copied
> app-locally into `node_modules/@embedded-postgres/windows-x64/native/bin/` — if you reinstall
> node_modules on a machine without the VC++ redistributable, copy `vcruntime140.dll`,
> `vcruntime140_1.dll` and `msvcp140.dll` there again (or install the VC++ redistributable).

## Going to production

1. Point `DATABASE_URL` at a managed PostgreSQL and run `npx prisma migrate deploy`.
2. Set a strong `JWT_SECRET`.
3. Configure the Payteller credentials to switch payments to live mode.
4. Replace simulated stock/ETF data with a real provider if those markets should go live.
5. `npm run build && npm start` behind HTTPS.
