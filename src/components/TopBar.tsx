"use client";

interface TopBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function TopBar({ searchTerm, onSearchChange }: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-b border-border bg-panel">
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-[13px] tracking-wider text-signal-text border border-signal-border bg-signal-fill px-2 py-0.5 rounded-md">
          OCIE
        </span>
        <div>
          <div className="font-bold text-[15px] text-foreground leading-tight">
            NSCLC guideline ↔ pipeline mapping
          </div>
          <div className="text-[11.5px] text-text-faint">
            Source: NCCN/ASCO treatment-mapping workbook · classification, no scoring
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="font-mono text-[11px] border border-border bg-background text-text-dim px-2.5 py-1 rounded-full"
          title="Reflects the guideline workbook currently seeded into the database"
        >
          Guideline snapshot: current
        </span>

        <div
          className="flex border border-border rounded-md overflow-hidden opacity-50 cursor-not-allowed"
          title="Phase 2 — requires timeline-projection data not yet in this dataset"
        >
          <span className="px-3 py-1.5 text-[12px] font-semibold text-text-dim border-r border-border">
            3-year
          </span>
          <span className="px-3 py-1.5 text-[12px] font-semibold text-text-dim">5-year</span>
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search drug, biomarker, or trial…"
          className="w-64 bg-background border border-border rounded-md px-3 py-1.5 text-[13px] text-foreground placeholder:text-text-faint"
        />
      </div>
    </header>
  );
}
