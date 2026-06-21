import type { Biomarker, OccurrenceWithDrug } from "@/types";
import { STATUS_LABEL, visualStatus } from "@/types";

interface TrialPipelinePanelProps {
  occurrences: OccurrenceWithDrug[];
  biomarkers: Biomarker[];
}

export function TrialPipelinePanel({ occurrences, biomarkers }: TrialPipelinePanelProps) {
  const biomarkerById = new Map(biomarkers.map((b) => [b.id, b]));

  if (occurrences.length === 0) {
    return (
      <div className="mx-6 mb-6 bg-panel border border-border rounded-lg p-7 text-center text-text-faint text-[12.5px]">
        No pipeline candidates found.
      </div>
    );
  }

  return (
    <div className="mx-6 mb-6 bg-panel border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1.4fr_1.6fr_0.9fr_0.9fr_1.6fr] gap-3 px-4 py-2.5 text-[10.5px] uppercase tracking-wide text-text-faint font-bold bg-background">
        <div>Drug</div>
        <div>Biomarker</div>
        <div>Line</div>
        <div>Status</div>
        <div>Evidence trials</div>
      </div>
      {occurrences.map((o) => {
        const vs = visualStatus(o);
        const biomarker = biomarkerById.get(o.biomarker_id);
        const pillCls =
          vs === "pipeline_pending"
            ? "bg-pending-fill border-pending-border text-pending-text"
            : "bg-signal-fill border-signal-border text-signal-text";
        return (
          <div
            key={`${o.drug.id}-${o.biomarker_id}-${o.line}`}
            className="grid grid-cols-[1.4fr_1.6fr_0.9fr_0.9fr_1.6fr] gap-3 px-4 py-2.5 text-[12.5px] border-t border-border-soft items-center"
          >
            <div className="font-semibold text-foreground">{o.drug.display_name}</div>
            <div className="text-text-dim">{biomarker ? biomarker.name : "Unmatched"}</div>
            <div className="text-text-dim">{o.line}</div>
            <div>
              <span className={`inline-block font-mono text-[10.5px] px-2 py-0.5 rounded-full border ${pillCls}`}>
                {STATUS_LABEL[vs]}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {o.evidence_trials && o.evidence_trials.length > 0 ? (
                o.evidence_trials.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[10px] bg-signal-fill text-signal-text border border-signal-border rounded-full px-1.5 py-0.5"
                  >
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-text-faint">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
