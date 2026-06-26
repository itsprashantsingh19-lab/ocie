import { getPool } from "./db";
import type { Regimen, Trial, DashboardData, WhiteSpaceRow } from "@/types";

export async function getDashboardData(): Promise<DashboardData> {
  const pool = getPool();

  const [regimens, trials, whiteSpace] = await Promise.all([
    pool.query<Regimen>(
      `select id, drug, type, single_or_combination, drug_class, mechanism,
              biomarker, biomarker_detail, histology, lot, tier, setting,
              route, notes, pd_l1_expression, patient_population, source_sheet
       from regimens
       order by biomarker, drug`
    ),
    pool.query<Trial>(
      `select id, nct_id, drug_name, title, phases, status,
              start_date, primary_completion_date, enrollment
       from trials
       order by drug_name`
    ),
    pool.query<WhiteSpaceRow>(
      `with bio_lot as (
         select biomarker, lot,
                count(*) as total,
                count(*) filter (where tier = 'Preferred') as preferred,
                count(*) filter (where tier = 'UICC') as uicc,
                count(*) filter (where tier = 'Subsequent') as subsequent
         from regimens
         group by biomarker, lot
       ),
       bio_trials as (
         select r.biomarker,
                count(distinct rt.nct_id) as trials,
                count(distinct rt.nct_id) filter (where t.status not in ('TERMINATED','WITHDRAWN','COMPLETED')) as active_trials
         from regimens r
         join regimen_trials rt on rt.regimen_id = r.id
         join trials t on t.nct_id = rt.nct_id
         group by r.biomarker
       )
       select bl.biomarker, bl.lot, bl.total, bl.preferred, bl.uicc, bl.subsequent,
              coalesce(bt.trials, 0) as trials,
              coalesce(bt.active_trials, 0) as active_trials
       from bio_lot bl
       left join bio_trials bt on bt.biomarker = bl.biomarker
       order by bl.biomarker, bl.lot`
    ),
  ]);

  return {
    regimens: regimens.rows,
    trials: trials.rows,
    whiteSpace: whiteSpace.rows,
  };
}
