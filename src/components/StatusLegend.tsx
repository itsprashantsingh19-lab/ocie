export function StatusLegend() {
  const items: { label: string; fill: string; border: string; dashed?: boolean }[] = [
    { label: "Current SOC", fill: "bg-soc-fill", border: "border-soc-border" },
    { label: "Pipeline — pending", fill: "bg-pending-fill", border: "border-pending-border" },
    { label: "Hedged, trial signal found", fill: "bg-signal-fill", border: "border-signal-border" },
    { label: "White space / gap", fill: "bg-gap-fill", border: "border-gap-border" },
    { label: "Unclear — needs review", fill: "bg-unclear-fill", border: "border-unclear-border", dashed: true },
  ];

  return (
    <div className="flex flex-wrap gap-4 mb-4 text-[11.5px] text-text-dim">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <i
            className={`inline-block w-2.5 h-2.5 rounded-full border ${it.fill} ${it.border} ${
              it.dashed ? "border-dashed" : ""
            }`}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
