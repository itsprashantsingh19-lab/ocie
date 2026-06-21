import type { Kpis } from "@/lib/dashboard-utils";

interface KpiRowProps {
  kpis: Kpis;
}

export function KpiRow({ kpis }: KpiRowProps) {
  const cards = [
    { label: "Biomarkers mapped", value: kpis.biomarkerCount, accent: "text-foreground" },
    { label: "Current SOC drugs", value: kpis.currentSocCount, accent: "text-soc-text" },
    { label: "Pipeline candidates", value: kpis.pipelineCount, accent: "text-pending-text" },
    { label: "Needs review", value: kpis.needsReviewCount, accent: "text-unclear-text" },
    { label: "Evidence trials found", value: kpis.evidenceTrialCount, accent: "text-signal-text" },
  ];

  return (
    <div className="flex flex-wrap gap-2.5 px-6 py-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-card border border-border rounded-lg px-4 py-2.5 min-w-[140px] shadow-[0_1px_2px_rgba(20,24,38,0.04)]"
        >
          <div className={`font-mono text-[21px] font-bold ${c.accent}`}>{c.value}</div>
          <div className="text-[11px] text-text-dim uppercase tracking-wide">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
