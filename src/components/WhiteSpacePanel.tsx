import type { Biomarker, OccurrenceWithDrug } from "@/types";

interface WhiteSpacePanelProps {
  occurrences: OccurrenceWithDrug[];
  biomarkers: Biomarker[];
}

export function WhiteSpacePanel({ occurrences, biomarkers }: WhiteSpacePanelProps) {
  const biomarkerById = new Map(biomarkers.map((b) => [b.id, b]));

  if (occurrences.length === 0) {
    return (
      <div className="mx-6 mb-6 bg-panel border border-border rounded-lg p-7 text-center text-text-faint text-[12.5px] leading-relaxed">
        No entries in the current workbook explicitly state &ldquo;no guideline entry&rdquo; / a gap.
        <br />
        This view will populate automatically as that language appears in updated guideline text — nothing fabricated here.
      </div>
    );
  }

  return (
    <div className="mx-6 mb-6 bg-panel border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1.4fr_1.6fr_0.9fr_2.1fr] gap-3 px-4 py-2.5 text-[10.5px] uppercase tracking-wide text-text-faint font-bold bg-background">
        <div>Drug</div>
        <div>Biomarker</div>
        <div>Line</div>
        <div>Raw text</div>
      </div>
      {occurrences.map((o) => {
        const biomarker = biomarkerById.get(o.biomarker_id);
        return (
          <div
            key={`${o.drug.id}-${o.biomarker_id}-${o.line}`}
            className="grid grid-cols-[1.4fr_1.6fr_0.9fr_2.1fr] gap-3 px-4 py-2.5 text-[12.5px] border-t border-border-soft items-center"
          >
            <div className="font-semibold text-foreground">{o.drug.display_name}</div>
            <div className="text-text-dim">{biomarker ? biomarker.name : "Unmatched"}</div>
            <div className="text-text-dim">{o.line}</div>
            <div className="text-text-dim">{o.raw_text}</div>
          </div>
        );
      })}
    </div>
  );
}
