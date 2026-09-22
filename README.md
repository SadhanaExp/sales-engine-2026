# Experience Sales Engine — Lead & Deal Workspace

The front half of the Experience.com Sales Engine, as a working application:

**Customer Inquiry → Opportunity → Qualification → AI Opportunity Intelligence → Quote Context → Ready to Contract**

One origin locally: **http://localhost:3000**. Ready to Contract is native Next.js (`/guided-selling`, `/api/contract`).

**Standalone Vaultline** (submit / demo as its own app) lives in [`apps/ready-to-contract`](apps/ready-to-contract) on the `ready-to-contract-app` branch: `cd apps/ready-to-contract && npm install && npm run dev` → **http://localhost:3001**.


Two experiences in one app:

- **Talk to Sales** at `/inquire` — a prospect submits company, contact, users, interest and requirements; a lead is created instantly and they can book a discovery call.
- **Internal workspace** at `/` (login required) — pipeline, Scheduled Tasks, per-lead workspace (Contacts, Activity, Qualification, AI Opportunity Intelligence), and **Ready to Contract** (Admin only): Quote Context → handoff into Quote → Approval → Contract → E-signature → Renewal.

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui-style components on Radix · PostgreSQL (Supabase-compatible).

## Run it locally

**You need:** Node 20+ and PostgreSQL 14+ on port 5432 (Postgres.app, Homebrew, or a Docker container named `sales_engine_pg` all work). Or point `DATABASE_URL` at a Supabase project — nothing in the code is Supabase-specific.

```bash
npm install

createdb sales_engine                 # skip if the database already exists
cp .env.example .env.local
# Edit DATABASE_URL for your Postgres, e.g.
#   DATABASE_URL=postgres://<your-mac-username>@localhost:5432/sales_engine
# Keep:
#   NEXT_PUBLIC_STAGE_NAME=Ready to Contract
#   NEXT_PUBLIC_PARTNER_MODULE_NAME=Ready to Contract
# Optional: ANTHROPIC_API_KEY=sk-ant-…  → AI runs on Claude (otherwise Deterministic)

npm run db:setup                      # schema + demo seed (wipes existing demo rows)
npm run dev                           # http://localhost:3000
```

## Deploy (Vercel)

The Next.js workspace deploys from GitHub to Vercel. You need a **hosted**
Postgres URL (Neon or Supabase) — local Docker Postgres is not reachable.

1. `DATABASE_URL='postgres://…hosted…' npm run db:setup`
2. Import https://github.com/SadhanaExp/sales-engine-2026 at [vercel.com/new](https://vercel.com/new)
3. Set `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_STAGE_NAME=Ready to Contract`, `NEXT_PUBLIC_PARTNER_MODULE_NAME=Ready to Contract`

Full steps: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

If `psql` is not on your PATH (common with Docker-only Postgres), apply the schema yourself then seed:

```bash
docker exec -i sales_engine_pg psql -U <user> -d sales_engine -v ON_ERROR_STOP=1 < db/schema.sql
npm run db:seed
```

Sign in:

| Account | Password | Role |
|---|---|---|
| `sandhya@experience.com` | `demo1234` | Admin — full lifecycle, including Ready to Contract |
| `sadhana@experience.com` | `demo1234` | Sales User — lifecycle up to Scheduled Tasks |
| `marcus@experience.com` | `demo1234` | Sales User |

`npm run db:seed` resets to a clean demo: six companies (Acme, FinEdge, Meridian Home Loans, Nova Insurance, BrightPath Realty, Summit Care Clinics) across New / Contacted / Quoted / Won. **It truncates leads, contacts, companies, activities and users** — do not run it if you have data you want to keep.

## Suggested demo path

1. Open `/inquire` and submit an inquiry as a customer (optionally book a discovery call).
2. Sign in at `/login` as Sandhya — the new lead is at the top of the pipeline and in the bell.
3. Open it: Contacts · Activity · Qualification · **AI Intelligence**. Best AI walkthrough: **Meridian Home Loans**.
4. Fill Qualification; **Continue to Contract →** lights up when context is complete (or **Complete Qualification →** jumps to the missing field). Admin only.
5. Quote Context review → Continue — the same customer appears under **Ready to Contract**: Accept handoff → Customer 360 → Contract → Signing → Renewal.

**Scheduled Tasks** (`/tasks`) is the work list (calls, gaps, next actions). The week calendar is **`/schedule`** — linked from the bottom of Scheduled Tasks, not a second sidebar item.

Open **http://localhost:3000**.

## Naming (Ready to Contract vs Guided Selling)

The **stage people see** is **Ready to Contract** (sidebar, pipeline, badges, CTAs, AI copy). Set it in `.env.local`:

```
NEXT_PUBLIC_STAGE_NAME=Ready to Contract
NEXT_PUBLIC_PARTNER_MODULE_NAME=Ready to Contract
```

The **route** stays `/guided-selling` — that is an integration name, not the label. Copying `.env.example` without changing those two lines used to restore “Guided Selling” in the UI.

## Roles and access

Two roles in `app_users.role`:

| | Sales User | Admin |
| --- | --- | --- |
| Inquiries, pipeline, opportunity workspace, contacts, activity, qualification, AI Deal Brief, Scheduled Tasks | yes | yes |
| Ready to Contract, quote context review, handoff | no | yes |

Enforced on the server (`canAccessContract` in `src/lib/roles.ts`, `src/lib/authz.ts`, `src/proxy.ts`) — typing the URL or curling the API gets the same answer as the hidden nav item.

## AI Opportunity Intelligence

A bounded workflow (`src/lib/ai/orchestrator.ts`), not a chatbot:

```
tools (read-only) → deterministic extraction → retrieval from the Sales Knowledge Base
  → 1. Opportunity Analyst   (Claude · every claim cites a source)
  → 2. Solution Context      (Claude · every item cites a retrieved doc)
  → 3. Readiness / Evaluator (deterministic guardrail + Claude review)
  → Opportunity Intelligence on the lead → salesperson reviews → Continue to Contract →
```

- Tools in `src/lib/ai/tools.ts` are read-only. The AI never changes stage, qualification, or the handoff.
- Knowledge base: `src/lib/ai/knowledge/` — no pricing, packages or tiers.
- Evaluator strips invented figures, unretrieved citations, and pricing language. Readiness is a ✓/⚠ checklist.
- Card label: **Claude · \<model\>** or **Deterministic**. Set `ANTHROPIC_API_KEY` for Claude; otherwise each stage falls back and says so.
- Evals: `npm run eval:ai` (nine cases). `npm run eval:ai -- --claude` also runs Claude.

## Team, ownership and coverage

Every lead has an **Owner**. New inquiries are routed (`src/lib/routing.ts`) by industry coverage, then by fewest open deals. The sidebar **Team** section filters to *My leads*, a colleague, or *Unassigned*.

## Talk to Sales and discovery-call booking

`/inquire` (also `/talk-to-sales`). Required: company, full name, work email, phone, industry, number of users. Validated against `src/lib/inquiry-schema.ts`.

On confirmation the customer can book a discovery call. Without Google Calendar env vars the app uses labelled **“Demo availability — Google Calendar not configured”** (`src/lib/calendar/`). It never claims Google is connected when it isn’t. See `.env.example` for service-account and `SALES_*` settings.

## Sign in

Email + password (`app_users`, bcrypt) or **Sign in with Google** (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`). Until those are set, the button explains it isn’t configured. Only existing accounts or new `@experience.com` accounts (`GOOGLE_ALLOWED_DOMAINS`) get in. Customers never sign in.

## Where leads come from

- **Talk to Sales** — `/inquire`
- **Internal** — **+ New Lead**
- **Other channels** — `POST /api/inquiries` with `X-Inbound-Key: <INBOUND_API_KEY>`. Body: `companyName, contactName, workEmail, phone?, numberOfUsers, interest, industry?, requirements, additionalInfo?, source?`. Replies `201 { leadId, companyId, companyMatched, leadUrl }`.

Industry is shown on each pipeline row and filterable from the sidebar.

## Ready to Contract

Native Next.js at **`/guided-selling`**, with state in Postgres (`contract_workspace_state`) and APIs at **`/api/contract/*`**.

**Continue to Contract** writes schema-2.0 quote context into that store and opens Ready to Contract on the same customer. No quote amount, package or discount is sent — Ready to Contract prices the deal. Handoff contract: **[docs/QUOTE_HANDOFF.md](docs/QUOTE_HANDOFF.md)**. Public deploy: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Where things live

| Area | Path |
|---|---|
| Schema | `db/schema.sql` |
| Seed | `db/seed.ts` |
| Data access | `src/lib/db.ts`, `src/lib/repo/*` |
| Stage labels | `src/lib/modules.ts` |
| Server actions | `src/app/actions/*.ts` |
| Talk to Sales | `src/app/inquire/`, `src/components/inquire/` |
| Discovery-call booking | `src/lib/calendar/` |
| Dashboard | `src/app/(app)/page.tsx`, `src/components/dashboard/` |
| Scheduled Tasks | `src/app/(app)/tasks/page.tsx` |
| Week calendar | `src/app/(app)/schedule/page.tsx` |
| Lead workspace | `src/app/(app)/leads/[id]/` |
| Quote handoff | `src/app/(app)/leads/[id]/quote/page.tsx` |
| Ready to Contract page | `src/app/(app)/guided-selling/page.tsx` |
| Ready to Contract UI | `src/components/contract/` |
| Ready to Contract store | `src/lib/contract/` |
| AI workflow | `src/lib/ai/`; evals in `evals/ai-intelligence/` |

## If something doesn't start

- `address already in use` on 3000 — another Next.js copy is running; stop it and rerun.
- `connection refused … 5432` — Postgres isn’t running, or `DATABASE_URL` in `.env.local` is wrong.
- Login page loads but sign-in fails — `npm run db:seed` to recreate demo users.
- **Ready to Contract** missing from the nav — you are a Sales User. Sign in as `sandhya@experience.com`.
- Sidebar still says Guided Selling — set `NEXT_PUBLIC_STAGE_NAME` / `NEXT_PUBLIC_PARTNER_MODULE_NAME` to `Ready to Contract` and restart `npm run dev`.

## Scope boundary

This app owns inquiry through Ready to Contract, including package recommendation, contract generation, e-signature demo, documents and renewal copilot.
