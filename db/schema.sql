-- OCIE: Oncology Guidelines Intelligence Engine
-- Supabase schema for Current SOC + Pipeline + White Space modules

-- Regimens: one row per drug/regimen entry from NCCN/ASCO guidelines
CREATE TABLE IF NOT EXISTS regimens (
  id SERIAL PRIMARY KEY,
  drug TEXT NOT NULL,
  type TEXT,
  single_or_combination TEXT,
  drug_class TEXT,
  mechanism TEXT,
  biomarker TEXT,
  biomarker_detail TEXT,
  histology TEXT,
  lot TEXT,
  tier TEXT,
  setting TEXT,
  route TEXT,
  notes TEXT,
  pd_l1_expression TEXT,
  patient_population TEXT,
  source_sheet TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trials: NCT IDs and metadata from ClinicalTrials.gov
CREATE TABLE IF NOT EXISTS trials (
  id SERIAL PRIMARY KEY,
  nct_id TEXT UNIQUE NOT NULL,
  drug_name TEXT,
  title TEXT,
  phases TEXT[],
  status TEXT,
  start_date TEXT,
  primary_completion_date TEXT,
  enrollment INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction: which trials are linked to which regimens
CREATE TABLE IF NOT EXISTS regimen_trials (
  regimen_id INTEGER REFERENCES regimens(id) ON DELETE CASCADE,
  nct_id TEXT REFERENCES trials(nct_id) ON DELETE CASCADE,
  PRIMARY KEY (regimen_id, nct_id)
);

-- Inclusion criteria: linked by NCT ID (populated later from trial protocols)
CREATE TABLE IF NOT EXISTS inclusion_criteria (
  id SERIAL PRIMARY KEY,
  nct_id TEXT REFERENCES trials(nct_id) ON DELETE CASCADE,
  criterion TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exclusion criteria: linked by NCT ID (populated later from trial protocols)
CREATE TABLE IF NOT EXISTS exclusion_criteria (
  id SERIAL PRIMARY KEY,
  nct_id TEXT REFERENCES trials(nct_id) ON DELETE CASCADE,
  criterion TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_regimens_biomarker ON regimens(biomarker);
CREATE INDEX IF NOT EXISTS idx_regimens_lot ON regimens(lot);
CREATE INDEX IF NOT EXISTS idx_regimens_tier ON regimens(tier);
CREATE INDEX IF NOT EXISTS idx_trials_nct_id ON trials(nct_id);
CREATE INDEX IF NOT EXISTS idx_regimen_trials_regimen ON regimen_trials(regimen_id);
CREATE INDEX IF NOT EXISTS idx_regimen_trials_nct ON regimen_trials(nct_id);
