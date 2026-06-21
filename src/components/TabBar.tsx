"use client";

export type TabId = "current-soc" | "trial-pipeline" | "candidates" | "scenarios" | "white-space" | "insights";

const TABS: { id: TabId; label: string; disabled?: boolean; disabledReason?: string }[] = [
  { id: "current-soc", label: "Current SOC" },
  { id: "trial-pipeline", label: "Trial pipeline" },
  {
    id: "candidates",
    label: "Candidates",
    disabled: true,
    disabledReason: "Needs P(approval) scoring — not in this dataset yet",
  },
  {
    id: "scenarios",
    label: "Scenarios",
    disabled: true,
    disabledReason: "Needs Base/Upside/Disruption projection data — not in this dataset yet",
  },
  { id: "white-space", label: "White space" },
  { id: "insights", label: "Insights" },
];

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="flex gap-1 px-6 bg-panel border-b border-border overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          disabled={tab.disabled}
          title={tab.disabledReason}
          onClick={() => !tab.disabled && onChange(tab.id)}
          className={`px-3.5 py-2.5 text-[13px] font-semibold border-b-2 whitespace-nowrap transition ${
            tab.disabled
              ? "text-text-faint cursor-not-allowed opacity-60"
              : active === tab.id
                ? "text-signal-text border-signal-border"
                : "text-text-dim border-transparent hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.disabled && <span className="ml-1.5 text-[9px] align-top">●</span>}
        </button>
      ))}
    </nav>
  );
}
