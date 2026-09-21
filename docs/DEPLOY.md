# Deploying the Sales Engine publicly

There are two honest ways to put this on the internet. Pick based on whether
**Ready to Contract** has to work on the live URL.

| Goal | Host |
|---|---|
| Talk to Sales, login, pipeline, AI, Scheduled Tasks | **Vercel** (this Next.js app) + hosted Postgres |
| The whole product including Ready to Contract (FastAPI) | **Render** (Docker) — one container, two processes |

Vercel runs serverless Node. It cannot start `uvicorn` next to `next start`,
so `QUOTE_WORKSPACE_URL=http://127.0.0.1:8001` does **not** work there. The
contract module stays in `modules/guided-selling` and is served from a
container (Render) or left unconfigured on Vercel.

Local Postgres on your Mac is not reachable from Vercel. You need a hosted
database (Neon, Supabase, or Vercel Postgres).

---

## Vercel (Next.js workspace)

Repo: https://github.com/SadhanaExp/sales-engine-2026

### 1. Hosted Postgres

Create a project on [Neon](https://neon.tech) or [Supabase](https://supabase.com).
Copy the URI (use the **pooler** on port 5432 / 6543).

From this repo, apply schema + demo users **once** (this wipes demo tables):

```bash
DATABASE_URL='postgres://…your-hosted-db…' npm run db:setup
```

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
| `HANDOFF_API_KEY` | no | any shared secret; unused unless a module URL is set |
| `INBOUND_API_KEY` | no | for `POST /api/inquiries` |
| `ANTHROPIC_API_KEY` | no | Claude; omit for Deterministic |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Google sign-in |
| `QUOTE_WORKSPACE_URL` | **leave unset** | localhost:8001 is not a Vercel service |

`QUOTE_WORKSPACE_URL` is read at **build** time (`next.config.ts` rewrites). Do
not point it at `127.0.0.1`.

4. Deploy. The live URL is `https://<project>.vercel.app`.

5. If you enable Google sign-in, add
   `https://<project>.vercel.app/api/auth/google/callback` to the OAuth client.

### 3. What works on Vercel

Works: `/inquire`, `/login`, pipeline, lead workspace, AI Intelligence,
Scheduled Tasks, `/schedule`.

Does not work: **Ready to Contract** embed (no FastAPI process). The nav entry
is still there for Admins; the module panel reports it is not configured.

### Hobby plan limits

AI regeneration can exceed 10 seconds without `ANTHROPIC_API_KEY` it is usually
fine. With Claude, a Pro plan (or `maxDuration`) is safer. This app sets
`maxDuration = 60` on the root layout; Hobby still caps at the plan maximum.

---

## Render (full app, including Ready to Contract)

One Docker image (`Dockerfile`): FastAPI on loopback, Next.js public.

1. Hosted Postgres as above; `DATABASE_URL='…' npm run db:setup`.
2. On Render: New → **Blueprint** → this repo (`render.yaml`).
3. Set `DATABASE_URL`. Leave `SESSION_SECRET` / `HANDOFF_API_KEY` generated.
   Do **not** set `QUOTE_WORKSPACE_URL` — the Dockerfile pins it to loopback.
4. Walk `/inquire` → login → opportunity → **Continue to Contract** on the
   Render URL.

Free Render sleeps after inactivity (~30s cold start). The module store is
in-memory and resets on restart; opening the opportunity re-delivers context.

```bash
docker build -t sales-engine .
docker run -p 3000:3000 -e DATABASE_URL='…' -e SESSION_SECRET=dev sales-engine
```
