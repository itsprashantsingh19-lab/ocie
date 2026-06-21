"use client";

import type { OccurrenceWithDrug } from "@/types";
import { STATUS_LABEL, visualStatus } from "@/types";

const BADGE_CLASSES: Record<string, string> = {
  current_soc: "bg-soc-fill border-soc-border text-soc-text",
  pipeline_pending: "bg-pending-fill border-pending-border text-pending-text",
  pipeline_signal: "bg-signal-fill border-signal-border text-signal-text",
  white_space_gap: "bg-gap-fill border-gap-border text-gap-text",
  unclear: "bg-unclear-fill border-unclear-border text-unclear-text border-dashed",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <div className="text-[10.5px] uppercase tracking-wide text-text-faint mb-0.5">{label}</div>
      <div className="text-[12.5px] text-foreground">{value}</div>
    </div>
  );
}

interface DetailPanelProps {
  occurrence: OccurrenceWithDrug | null;
}

export function DetailPanel({ occurrence }: DetailPanelProps) {
  if (!occurrence) {
    return (
      <aside className="w-[320px] flex-shrink-0 bg-panel border-l border-border p-4.5 overflow-y-auto">
        <p className="text-text-faint text-[12.5px] text-center mt-10">Click a drug card to see details.</p>
      </aside>
    );
  }

  const vs = visualStatus(occurrence);

  return (
    <aside className="w-[320px] flex-shrink-0 bg-panel border-l border-border p-4.5 overflow-y-auto">
      <h3 className="text-[16px] font-bold text-foreground mb-1">{occurrence.drug.display_name}</h3>
      <div
        className={`inline-block font-mono text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border mb-3.5 ${BADGE_CLASSES[vs]}`}
      >
        {STATUS_LABEL[vs]}
      </div>

      <Field label="Line / Track" value={`${occurrence.line} · ${occurrence.track}`} />
      {occurrence.drug.drug_class && <Field label="Drug class" value={occurrence.drug.drug_class} />}
      {occurrence.drug.mechanism && <Field label="Mechanism" value={occurrence.drug.mechanism} />}
      {occurrence.histology && <Field label="Histology" value={occurrence.histology} />}
      {occurrence.setting && <Field label="Setting" value={occurrence.setting} />}
      {occurrence.route && <Field label="Route" value={occurrence.route} />}
      {occurrence.safety_notes && <Field label="Safety notes" value={occurrence.safety_notes} />}
      <Field label="Source" value={occurrence.drug.source === "missing_drugs" ? "Pipeline sheet" : "Guideline sheet"} />

      {occurrence.evidence_trials && occurrence.evidence_trials.length > 0 && (
        <div className="mb-3">
          <div className="text-[10.5px] uppercase tracking-wide text-text-faint mb-1">
            Evidence trials (NLP-extracted)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {occurrence.evidence_trials.map((t) => (
              <span
                key={t}
                className="font-mono text-[10.5px] bg-signal-fill text-signal-text border border-signal-border rounded-full px-2 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {occurrence.raw_text && (
        <div className="border-t border-border-soft pt-2.5 mt-2.5">
          <Field label="Raw source text" value={occurrence.raw_text} />
        </div>
      )}

      {occurrence.status === "ambiguous" && (
        <div className="text-[10.5px] text-text-faint italic mt-3.5 border-t border-dashed border-border pt-2">
          Status auto-detected as &ldquo;{STATUS_LABEL[vs]}&rdquo; by the rule-based NLP layer from this text — treat as a first pass, not ground truth.
        </div>
      )}
    </aside>
  );
}
