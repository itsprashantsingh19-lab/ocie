# OCIE — Oncology Guidelines Intelligence Engine

NSCLC drug-to-guideline mapping by biomarker and line of therapy. Displays current SOC (NCCN/ASCO) with pipeline/white space/insights modules in development.

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Postgres** via `DATABASE_URL` (Supabase, Neon, or Vercel Postgres)
- **No ORM** — plain `pg` with typed queries
- **Seed**: Node/TypeScript reads xlsx + NCT mapping → Postgres

## Quick start

```bash
npm install

# 1. Set up Postgres (Supabase recommended)
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL

# 2. Apply schema
# Paste db/schema.sql into Supabase SQL editor, or:
psql "$DATABASE_URL" -f db/schema.sql

# 3. Seed data
npm run db:seed

# 4. Run
npm run dev
```

## Schema

- **regimens** — drug/regimen data from NCCN/ASCO xlsx
- **trials** — NCT IDs and metadata from ClinicalTrials.gov
- **regimen_trials** — junction linking regimens to trials
- **inclusion_criteria / exclusion_criteria** — trial criteria (populated later)

## Deploy to Vercel

1. Push to GitHub
2. Import into Vercel
3. Add `DATABASE_URL` environment variable in Vercel project settings
4. Deploy

Built for the data/Current Treatment mapping(NCCN_ASCO) for NSCLC.xlsx source file.
