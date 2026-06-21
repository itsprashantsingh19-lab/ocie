"use client";

import { useMemo, useState } from "react";
import type { DashboardData, OccurrenceWithDrug } from "@/types";
import {
  computeInsights,
  computeKpis,
  joinOccurrences,
  occurrencesForBiomarker,
  pipelineCandidates,
  whiteSpaceEntries,
} from "@/lib/dashboard-utils";
import { TopBar } from "./TopBar";
import { TabBar, type TabId } from "./TabBar";
import { KpiRow } from "./KpiRow";
import { BiomarkerRail } from "./BiomarkerRail";
import { TreatmentGrid } from "./TreatmentGrid";
import { DetailPanel } from "./DetailPanel";
import { TrialPipelinePanel } from "./TrialPipelinePanel";
import { WhiteSpacePanel } from "./WhiteSpacePanel";
import { InsightsPanel } from "./InsightsPanel";

export function Dashboard({ data }: { data: DashboardData }) {
  const occurrences = useMemo(() => joinOccurrences(data), [data]);

  const [activeTab, setActiveTab] = useState<TabId>("current-soc");
  const [trackFilter, setTrackFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBiomarkerId, setSelectedBiomarkerId] = useState<string | null>(
    data.biomarkers[0]?.id ?? null
  );
  const [selectedOccurrence, setSelectedOccurrence] = useState<OccurrenceWithDrug | null>(null);

  const kpis = useMemo(() => computeKpis(data, occurrences), [data, occurrences]);
  const insights = useMemo(() => computeInsights(data, occurrences), [data, occurrences]);
  const pipeline = useMemo(() => pipelineCandidates(occurrences), [occurrences]);
  const whiteSpace = useMemo(() => whiteSpaceEntries(occurrences), [occurrences]);

  const selectedBiomarker = data.biomarkers.find((b) => b.id === selectedBiomarkerId) ?? null;
  const gridOccurrences = selectedBiomarkerId
    ? occurrencesForBiomarker(occurrences, selectedBiomarkerId)
    : [];

  function handleSelectBiomarker(id: string) {
    setSelectedBiomarkerId(id);
    setSelectedOccurrence(null);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <TabBar active={activeTab} onChange={setActiveTab} />
      <KpiRow kpis={kpis} />

      {activeTab === "current-soc" && (
        <div className="flex flex-1 min-h-0">
          <BiomarkerRail
            biomarkers={data.biomarkers}
            occurrences={occurrences}
            selectedId={selectedBiomarkerId}
            onSelect={handleSelectBiomarker}
            trackFilter={trackFilter}
            onTrackFilterChange={setTrackFilter}
            searchTerm={searchTerm}
          />
          <TreatmentGrid
            biomarker={selectedBiomarker}
            occurrences={gridOccurrences}
            onSelectOccurrence={setSelectedOccurrence}
          />
          <DetailPanel occurrence={selectedOccurrence} />
        </div>
      )}

      {activeTab === "trial-pipeline" && (
        <div>
          <div className="px-6 mb-3.5">
            <h2 className="text-[18px] font-bold text-foreground mb-1">Trial pipeline candidates</h2>
            <p className="text-[12.5px] text-text-dim">
              Every drug flagged <strong>pipeline — pending</strong> or{" "}
              <strong>hedged with a trial signal</strong>, across all biomarkers. Evidence-trial tags are pulled
              from the guideline text itself via the NLP layer — not a live trial-registry count.
            </p>
          </div>
          <TrialPipelinePanel occurrences={pipeline} biomarkers={data.biomarkers} />
        </div>
      )}

      {activeTab === "white-space" && (
        <div>
          <div className="px-6 mb-3.5">
            <h2 className="text-[18px] font-bold text-foreground mb-1">White space / guideline gaps</h2>
            <p className="text-[12.5px] text-text-dim">
              Entries where the source text explicitly states no current guideline entry exists.
            </p>
          </div>
          <WhiteSpacePanel occurrences={whiteSpace} biomarkers={data.biomarkers} />
        </div>
      )}

      {activeTab === "insights" && (
        <div>
          <div className="px-6 mb-3.5">
            <h2 className="text-[18px] font-bold text-foreground mb-1">Insights</h2>
            <p className="text-[12.5px] text-text-dim">
              Aggregate counts derived directly from the parsed workbook. No probability or forecasting —
              that needs trial-level data not present in this phase.
            </p>
          </div>
          <InsightsPanel insights={insights} />
        </div>
      )}
    </div>
  );
}
