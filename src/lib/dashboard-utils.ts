import type { Biomarker, DashboardData, Drug, OccurrenceWithDrug, VisualStatus } from "@/types";
import { visualStatus } from "@/types";

export function joinOccurrences(data: DashboardData): OccurrenceWithDrug[] {
  const drugById = new Map<string, Drug>(data.drugs.map((d) => [d.id, d]));
  return data.occurrences
    .map((o) => {
      const drug = drugById.get(o.drug_id);
      if (!drug) return null;
      return { ...o, drug };
    })
    .filter((o): o is OccurrenceWithDrug => o !== null);
}

export function occurrencesForBiomarker(
  occurrences: OccurrenceWithDrug[],
  biomarkerId: string
): OccurrenceWithDrug[] {
  return occurrences.filter((o) => o.biomarker_id === biomarkerId);
}

const TRACK_COLOR_PREFIXES: [string, string][] = [
  ["Track A", "bg-track-a"],
  ["Track B", "bg-track-b"],
  ["Track C - Biomarker", "bg-track-c"],
  ["Track C - Driver Negative", "bg-track-driver-neg"],
  ["Uncommon", "bg-track-uncommon"],
  ["Pipeline", "bg-track-pipeline"],
];

export function trackDotClass(track: string): string {
  for (const [prefix, cls] of TRACK_COLOR_PREFIXES) {
    if (track.startsWith(prefix)) return cls;
  }
  return "bg-text-faint";
}

export function matchesSearch(
  biomarker: Biomarker,
  occurrences: OccurrenceWithDrug[],
  term: string
): boolean {
  if (!term) return true;
  const t = term.toLowerCase();
  if (biomarker.name.toLowerCase().includes(t)) return true;
  return occurrencesForBiomarker(occurrences, biomarker.id).some((o) => {
    const hay = [o.drug.display_name, o.drug.mechanism, ...(o.evidence_trials ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(t);
  });
}

export function pipelineCandidates(occurrences: OccurrenceWithDrug[]): OccurrenceWithDrug[] {
  return occurrences.filter((o) => {
    const vs = visualStatus(o);
    return vs === "pipeline_pending" || vs === "pipeline_signal";
  });
}

export function whiteSpaceEntries(occurrences: OccurrenceWithDrug[]): OccurrenceWithDrug[] {
  return occurrences.filter((o) => visualStatus(o) === "white_space_gap");
}

export interface Kpis {
  biomarkerCount: number;
  currentSocCount: number;
  pipelineCount: number;
  needsReviewCount: number;
  evidenceTrialCount: number;
}

export function computeKpis(data: DashboardData, occurrences: OccurrenceWithDrug[]): Kpis {
  const statusCounts: Record<VisualStatus, number> = {
    current_soc: 0,
    pipeline_pending: 0,
    pipeline_signal: 0,
    white_space_gap: 0,
    unclear: 0,
  };
  occurrences.forEach((o) => {
    statusCounts[visualStatus(o)] += 1;
  });

  const evidenceTrials = new Set<string>();
  occurrences.forEach((o) => (o.evidence_trials ?? []).forEach((t) => evidenceTrials.add(t)));
  data.biomarkers.forEach((b) => (b.notable_trials ?? []).forEach((t) => evidenceTrials.add(t)));

  return {
    biomarkerCount: data.biomarkers.length,
    currentSocCount: statusCounts.current_soc,
    pipelineCount: statusCounts.pipeline_pending + statusCounts.pipeline_signal,
    needsReviewCount: statusCounts.unclear,
    evidenceTrialCount: evidenceTrials.size,
  };
}

export interface InsightsData {
  byTrack: { track: string; count: number }[];
  byStatus: { status: VisualStatus; count: number }[];
  evidenceTrials: string[];
  unmatchedBiomarkers: number;
}

export function computeInsights(data: DashboardData, occurrences: OccurrenceWithDrug[]): InsightsData {
  const trackCounts = new Map<string, number>();
  data.biomarkers.forEach((b) => trackCounts.set(b.track, (trackCounts.get(b.track) ?? 0) + 1));

  const statusByDrug = new Map<string, Set<VisualStatus>>();
  occurrences.forEach((o) => {
    const set = statusByDrug.get(o.drug_id) ?? new Set<VisualStatus>();
    set.add(visualStatus(o));
    statusByDrug.set(o.drug_id, set);
  });
  const statusCounts = new Map<VisualStatus, number>();
  statusByDrug.forEach((set) => {
    set.forEach((s) => statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1));
  });

  const evidenceTrials = new Set<string>();
  occurrences.forEach((o) => (o.evidence_trials ?? []).forEach((t) => evidenceTrials.add(t)));
  data.biomarkers.forEach((b) => (b.notable_trials ?? []).forEach((t) => evidenceTrials.add(t)));

  return {
    byTrack: [...trackCounts.entries()]
      .map(([track, count]) => ({ track, count }))
      .sort((a, b) => b.count - a.count),
    byStatus: [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    evidenceTrials: [...evidenceTrials].sort(),
    unmatchedBiomarkers: data.biomarkers.filter((b) => b.track.startsWith("Pipeline")).length,
  };
}
