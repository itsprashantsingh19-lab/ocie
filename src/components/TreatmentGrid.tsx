"use client";

import type { Biomarker, OccurrenceWithDrug } from "@/types";
import { DrugCard } from "./DrugCard";
import { StatusLegend } from "./StatusLegend";

interface TreatmentGridProps {
  biomarker: Biomarker | null;
  occurrences: OccurrenceWithDrug[];
  onSelectOccurrence: (occ: OccurrenceWithDrug) => void;
}

export function TreatmentGrid({ biomarker, occurrences, onSelectOccurrence }: TreatmentGridProps) {
  if (!biomarker) {
    return (
      <main className="flex-1 p-6 overflow-y-auto">
        <p className="text-text-faint text-[13px]">Select a biomarker from the left to see its treatment algorithm.</p>
      </main>
    );
  }

  const lines = [...new Set(occurrences.map((o) => o.line))];

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <div className="mb-1">
        <h2 className="text-[19px] font-bold text-foreground">
          Treatment algorithm — {biomarker.name}
        </h2>
        <p className="text-[12.5px] text-text-dim mb-1">
          {biomarker.track}
          {biomarker.incidence_pct ? ` · Incidence: ${biomarker.incidence_pct}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11.5px] text-text-faint">Scenario:</span>
        <div
          className="flex border border-border rounded-md overflow-hidden opacity-50 cursor-not-allowed"
          title="Phase 2 — requires Base/Upside/Disruption projection data not yet in this dataset"
        >
          {["Base", "Upside", "Disruption"].map((s, i) => (
            <span
              key={s}
              className={`px-3 py-1 text-[11.5px] font-semibold text-text-dim ${
                i < 2 ? "border-r border-border" : ""
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <StatusLegend />

      {biomarker.notes && (
        <div className="mb-4 text-[12px] text-text-dim bg-card border border-border-soft rounded-md px-3 py-2">
          <span className="font-semibold text-text-faint uppercase text-[10px] tracking-wide block mb-0.5">
            Guideline notes
          </span>
          {biomarker.notes}
        </div>
      )}

      {lines.length === 0 ? (
        <p className="text-text-faint text-[12px] italic">
          No guideline or pipeline drugs mapped to this biomarker yet.
        </p>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {lines.map((line) => (
            <div key={line} className="bg-panel border border-border rounded-lg p-3">
              <h3 className="text-[12px] uppercase tracking-wide text-text-dim mb-2.5">{line}</h3>
              <div className="flex flex-col gap-1.5">
                {occurrences
                  .filter((o) => o.line === line)
                  .map((o) => (
                    <DrugCard key={`${o.drug.id}-${o.line}`} occurrence={o} onClick={() => onSelectOccurrence(o)} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
