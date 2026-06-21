"use client";

import type { OccurrenceWithDrug } from "@/types";
import { visualStatus } from "@/types";

const STATUS_CLASSES: Record<string, string> = {
  current_soc: "bg-soc-fill border-soc-border text-soc-text",
  pipeline_pending: "bg-pending-fill border-pending-border text-pending-text",
  pipeline_signal: "bg-signal-fill border-signal-border text-signal-text",
  white_space_gap: "bg-gap-fill border-gap-border text-gap-text",
  unclear: "bg-unclear-fill border-unclear-border text-unclear-text border-dashed",
};

interface DrugCardProps {
  occurrence: OccurrenceWithDrug;
  onClick: () => void;
}

export function DrugCard({ occurrence, onClick }: DrugCardProps) {
  const vs = visualStatus(occurrence);
  const cls = STATUS_CLASSES[vs] ?? STATUS_CLASSES.unclear;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2 text-[12.5px] cursor-pointer hover:brightness-[0.97] transition ${cls}`}
    >
      <span className="font-semibold block">{occurrence.drug.display_name}</span>
      {occurrence.evidence_trials && occurrence.evidence_trials.length > 0 && (
        <span className="block font-mono text-[10px] mt-1 opacity-80">
          {occurrence.evidence_trials.join(", ")}
        </span>
      )}
    </button>
  );
}
