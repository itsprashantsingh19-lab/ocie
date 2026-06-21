-- OCIE Guideline <-> Pipeline Mapping — schema
-- Host-agnostic: run this in the Supabase SQL editor, or against any
-- Postgres instance (Neon, Vercel Postgres, local) pointed at by DATABASE_URL.
--
-- Mirrors the data model in scripts/parse_guidelines.py exactly — one row
-- per biomarker, one per drug, one per (drug, biomarker, line) occurrence.
-- See PROJECT_BRIEF.md for the classification logic these columns encode.

drop table if exists occurrences;
drop table if exists drugs;
drop table if exists biomarkers;

create table biomarkers (
  id              text primary key,
  name            text not null,
  track           text not null,
  incidence_pct   text,
  notes           text,
  notable_trials  text[] not null default '{}'
);

create table drugs (
  id            text primary key,
  display_name  text not null,
  drug_class    text,
  mechanism     text,
  source        text not null check (source in ('guideline', 'missing_drugs'))
);

create table occurrences (
  id              serial primary key,
  drug_id         text not null references drugs(id) on delete cascade,
  biomarker_id    text not null references biomarkers(id) on delete cascade,
  track           text not null,
  line            text not null,
  status          text not null check (status in ('current_soc', 'pipeline_pending', 'ambiguous')),
  status_detail   text check (status_detail in ('white_space_gap', 'pipeline_signal', 'unclear')),
  raw_text        text,
  histology       text,
  setting         text,
  route           text,
  safety_notes    text,
  evidence_trials text[] not null default '{}'
);

create index idx_occurrences_biomarker on occurrences(biomarker_id);
create index idx_occurrences_drug on occurrences(drug_id);
create index idx_occurrences_status on occurrences(status);
create index idx_biomarkers_track on biomarkers(track);
