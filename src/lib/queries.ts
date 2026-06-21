import { getPool } from "./db";
import type { Biomarker, Drug, Occurrence, DashboardData } from "@/types";

/**
 * Fetches the full dataset in three queries. At this data size (tens of
 * biomarkers, ~100 drugs, ~200 occurrences) loading everything up front and
 * letting the client component filter/group in memory is simpler and faster
 * than paginated per-tab queries — revisit if the dataset grows an order of
 * magnitude.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const pool = getPool();

  const [biomarkers, drugs, occurrences] = await Promise.all([
    pool.query<Biomarker>(
      `select id, name, track, incidence_pct, notes, notable_trials
       from biomarkers
       order by track, name`
    ),
    pool.query<Drug>(
      `select id, display_name, drug_class, mechanism, source
       from drugs
       order by display_name`
    ),
    pool.query<Occurrence>(
      `select id, drug_id, biomarker_id, track, line, status, status_detail,
              raw_text, histology, setting, route, safety_notes, evidence_trials
       from occurrences
       order by id`
    ),
  ]);

  return {
    biomarkers: biomarkers.rows,
    drugs: drugs.rows,
    occurrences: occurrences.rows,
  };
}
