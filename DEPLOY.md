# Deploying CediX to Render

Everything is pre-configured in [`render.yaml`](./render.yaml). You only need a GitHub repo and a
Render account.

## 1. Push the code to GitHub

The repo is already initialized and committed locally. Create an empty repository on GitHub
(e.g. `cedix`), then:

```bash
git remote add origin https://github.com/<your-username>/cedix.git
git push -u origin main
```

> ⚠️ `.env` is git-ignored — secrets never leave your machine.

## 2. Deploy the Blueprint

1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New + → Blueprint**.
3. Connect the GitHub repo. Render reads `render.yaml` and creates:
   - **cedix** — Node web service (Frankfurt region)
   - **cedix-db** — managed PostgreSQL 16
   - `DATABASE_URL` wired automatically, `JWT_SECRET` auto-generated
4. Click **Apply**. First deploy takes a few minutes; migrations run automatically on start
   (`prisma migrate deploy`).

## 3. Seed the database (once)

In the Render dashboard → **cedix** service → **Shell** tab:

```bash
npm run db:seed
```

This creates the admin (`admin@cedix.gh / Admin123!`) and demo accounts, earn products, P2P offers
and default settings. **Change the admin password immediately** (or edit `prisma/seed.ts` before
deploying).

## 4. Go live with Payteller

In the Render dashboard → **cedix** → **Environment**, fill in:

- `PAYTELLER_BASE_URL`
- `PAYTELLER_API_KEY`
- `PAYTELLER_MERCHANT_ID`

Save → the service redeploys and payments switch from sandbox to live automatically.
Give Payteller your webhook URL: `https://<your-app>.onrender.com/api/payteller/webhook`.

## Important notes

| Topic | Detail |
| --- | --- |
| **Region** | Keep `frankfurt` (or `singapore`). Binance's public API blocks US IPs, so `oregon` would break live market data. |
| **Uploads disk** | `render.yaml` attaches a 1 GB persistent disk for Orbit media (needs a paid instance). On the free plan, delete the `disk:` block — uploads will then be lost on each deploy. |
| **Free plan** | Works for demos: the service sleeps after idle periods and the background limit-order matcher pauses while asleep. Use `starter` or higher for real trading. |
| **Custom domain** | Render dashboard → cedix → Settings → Custom Domains (automatic TLS). |
| **Scaling the DB** | `basic-256mb` is the smallest paid Postgres; upgrade the plan in `render.yaml` or the dashboard as users grow. |

## Alternative: Railway / any Docker host

A production [`Dockerfile`](./Dockerfile) is included. On Railway: **New Project → Deploy from
GitHub repo**, add a PostgreSQL plugin, set `DATABASE_URL`, `JWT_SECRET` and the Payteller
variables. The container applies migrations automatically on boot.
