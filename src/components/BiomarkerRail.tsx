"use client";

import type { Biomarker, OccurrenceWithDrug } from "@/types";
import { matchesSearch, trackDotClass } from "@/lib/dashboard-utils";

interface BiomarkerRailProps {
  biomarkers: Biomarker[];
  occurrences: OccurrenceWithDrug[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  trackFilter: string;
  onTrackFilterChange: (track: string) => void;
  searchTerm: string;
}

export function BiomarkerRail({
  biomarkers,
  occurrences,
  selectedId,
  onSelect,
  trackFilter,
  onTrackFilterChange,
  searchTerm,
}: BiomarkerRailProps) {
  const tracks = [...new Set(biomarkers.map((b) => b.track))].sort();

  let visible = biomarkers;
  if (trackFilter !== "all") visible = visible.filter((b) => b.track === trackFilter);
  if (searchTerm) visible = visible.filter((b) => matchesSearch(b, occurrences, searchTerm));

  const byTrack = new Map<string, Biomarker[]>();
  visible.forEach((b) => {
    const list = byTrack.get(b.track) ?? [];
    list.push(b);
    byTrack.set(b.track, list);
  });

  return (
    <aside className="w-[280px] flex-shrink-0 bg-panel border-r border-border flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border-soft flex items-center gap-2">
        <label className="text-[11px] uppercase tracking-wide text-text-dim">Track</label>
        <select
          value={trackFilter}
          onChange={(e) => onTrackFilterChange(e.target.value)}
          className="flex-1 bg-background border border-border rounded-md text-[12px] px-1.5 py-1 text-foreground"
        >
          <option value="all">All tracks</option>
          {tracks.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {[...byTrack.keys()].sort().map((track) => (
          <div key={track}>
            <div className="px-3.5 pt-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
              {track}
            </div>
            {byTrack.get(track)!.map((b) => {
              const trialCount = b.notable_trials?.length ?? 0;
              return (
                <div
                  key={b.id}
                  onClick={() => onSelect(b.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 cursor-pointer border-l-2 ${
                    b.id === selectedId
                      ? "bg-[#f3f6fd] border-l-signal-border"
                      : "border-l-transparent hover:bg-card-hover"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${trackDotClass(b.track)}`} />
                  <span className="text-[12.5px] text-foreground flex-1">{b.name}</span>
                  {trialCount > 0 && (
                    <span
                      className="font-mono text-[9.5px] text-signal-text bg-signal-fill rounded-full px-1.5 py-0.5 whitespace-nowrap"
                      title={b.notable_trials.join(", ")}
                    >
                      {trialCount} mention{trialCount > 1 ? "s" : ""}
                    </span>
                  )}
                  {b.incidence_pct && (
                    <span className="font-mono text-[10px] text-text-faint whitespace-nowrap">
                      {b.incidence_pct}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {visible.length === 0 && (
          <div className="p-4 text-[12px] text-text-faint italic">No biomarkers match.</div>
        )}
      </div>
    </aside>
  );
}
