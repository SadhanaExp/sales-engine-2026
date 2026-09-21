# Deploying the Sales Engine publicly

The whole product, including **Ready to Contract**, is this Next.js app. Deploy
it on **Vercel** with hosted Postgres (Neon, Supabase, or Vercel Postgres).

Local Postgres on your Mac is not reachable from Vercel.

Repo: https://github.com/SadhanaExp/sales-engine-2026

---

## Vercel

### 1. Hosted Postgres

Create a project on [Neon](https://neon.tech) or [Supabase](https://supabase.com).
Copy the URI (use the **pooler** on port 5432 / 6543).

From this repo, apply schema + demo users **once** (this wipes demo tables):

```bash
DATABASE_URL='postgres://…your-hosted-db…' npm run db:setup
```

`db/schema.sql` includes `contract_workspace_state`, the persisted Ready to
Contract workspace. Re-run `npm run db:schema` if that table is missing.

Sign-in after deploy: `sandhya@experience.com` / `demo1234` (Admin).

### 2. Import the GitHub repo

1. Open [vercel.com/new](https://vercel.com/new) and import `SadhanaExp/sales-engine-2026`.
2. Framework: **Next.js** (auto-detected). Root directory: `.`
3. Environment variables — set for **Production** (and Preview if you want):

| Name | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | hosted Postgres URI from step 1 |
| `SESSION_SECRET` | yes | a long random string, not `dev-only-change-me` |
| `NEXT_PUBLIC_STAGE_NAME` | yes | `Ready to Contract` |
| `NEXT_PUBLIC_PARTNER_MODULE_NAME` | yes | `Ready to Contract` |
| `HANDOFF_API_KEY` | no | shared key for `GET /api/handoff/{leadId}` |
| `INBOUND_API_KEY` | no | for `POST /api/inquiries` |
| `ANTHROPIC_API_KEY` | no | Claude; omit for Deterministic |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Google sign-in |

4. Deploy. The live URL is `https://<project>.vercel.app`.
5. If you enable Google sign-in, add
   `https://<project>.vercel.app/api/auth/google/callback` to the OAuth client.

Ready to Contract is Admin-only (`sandhya@experience.com`). It runs in the same
Vercel deployment at `/guided-selling` and `/api/contract`.

### Hobby plan limits

AI regeneration can exceed 10 seconds; without `ANTHROPIC_API_KEY` it is usually
fine. With Claude, a Pro plan (or `maxDuration`) is safer. This app sets
`maxDuration = 60` on the root layout; Hobby still caps at the plan maximum.

---

## Optional: Docker

The repo-root `Dockerfile` runs `next start` only:

```bash
docker build -t sales-engine .
docker run -p 3000:3000 -e DATABASE_URL='…' -e SESSION_SECRET=dev sales-engine
```
