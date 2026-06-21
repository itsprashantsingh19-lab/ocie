export type DrugStatus = "current_soc" | "pipeline_pending" | "ambiguous";
export type StatusDetail = "white_space_gap" | "pipeline_signal" | "unclear";

/** The 5-state visual classification used throughout the UI — collapses
 * `ambiguous` into its `status_detail` sub-state so every chip has exactly
 * one of these. */
export type VisualStatus =
  | "current_soc"
  | "pipeline_pending"
  | "pipeline_signal"
  | "white_space_gap"
  | "unclear";

export interface Biomarker {
  id: string;
  name: string;
  track: string;
  incidence_pct: string | null;
  notes: string | null;
  notable_trials: string[];
}

export interface Drug {
  id: string;
  display_name: string;
  drug_class: string | null;
  mechanism: string | null;
  source: "guideline" | "missing_drugs";
}

export interface Occurrence {
  id: number;
  drug_id: string;
  biomarker_id: string;
  track: string;
  line: string;
  status: DrugStatus;
  status_detail: StatusDetail | null;
  raw_text: string | null;
  histology: string | null;
  setting: string | null;
  route: string | null;
  safety_notes: string | null;
  evidence_trials: string[];
}

/** Flattened view used by the dashboard: an occurrence joined with its drug. */
export interface OccurrenceWithDrug extends Occurrence {
  drug: Drug;
}

export interface DashboardData {
  biomarkers: Biomarker[];
  drugs: Drug[];
  occurrences: Occurrence[];
}

export function visualStatus(occ: Pick<Occurrence, "status" | "status_detail">): VisualStatus {
  if (occ.status === "ambiguous") return occ.status_detail ?? "unclear";
  return occ.status;
}

export const STATUS_LABEL: Record<VisualStatus, string> = {
  current_soc: "Current SOC",
  pipeline_pending: "Pipeline — pending",
  pipeline_signal: "Hedged — trial signal found",
  white_space_gap: "White space / gap",
  unclear: "Unclear — needs review",
};
