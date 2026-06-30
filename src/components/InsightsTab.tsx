"use client";

import { useMemo } from "react";
import type { PipelineRow, Regimen, TimelineWeights, TrialProfile } from "@/types";
import { biomarkerBadgeClass, projectTimeline, profileToWeights } from "@/types";

interface Props {
  pipeline: PipelineRow[];
  whiteSpace: any[];
  regimens: Regimen[];
  drugProfiles: Record<string, TrialProfile>;
  drugWeights: Record<string, TimelineWeights>;
}

export default function InsightsTab({ pipeline, regimens, drugProfiles, drugWeights }: Props) {
  const data = useMemo(() => {
    // Group pipeline drugs by biomarker+lOT
    const pipeByKey = new Map<string, (PipelineRow & { projSOC: string | null; horizonMo: number | null })[]>();
    for (const p of pipeline) {
      const dp = drugProfiles[p.nct_id];
      const dw = drugWeights[p.nct_id] || profileToWeights(dp);
      const proj = projectTimeline(p.primary_completion_date, dw);
      const key = `${p.biomarker}||${p.lot}`;
      if (!pipeByKey.has(key)) pipeByKey.set(key, []);
      pipeByKey.get(key)!.push({
        ...p,
        projSOC: proj?.projectedSOC || null,
        horizonMo: proj ? Math.round((new Date(proj.projectedSOC).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44)) : null,
      });
    }

    // Group regimens by biomarker
    const regByBm = new Map<string, Regimen[]>();
    for (const r of regimens) {
      if (!regByBm.has(r.biomarker)) regByBm.set(r.biomarker, []);
      regByBm.get(r.biomarker)!.push(r);
    }

    const result: {
      biomarker: string;
      regimens: Regimen[];
      pipeline: (PipelineRow & { projSOC: string | null; horizonMo: number | null })[];
    }[] = [];

    for (const [bm, regs] of regByBm) {
      const incoming: (PipelineRow & { projSOC: string | null; horizonMo: number | null })[] = [];
      for (const r of regs) {
        const key = `${bm}||${r.lot}`;
        const pipeDrugs = pipeByKey.get(key);
        if (pipeDrugs) {
          for (const pd of pipeDrugs) {
            if (!incoming.find((x) => x.nct_id === pd.nct_id)) {
              incoming.push(pd);
            }
          }
        }
      }
      result.push({ biomarker: bm, regimens: regs, pipeline: incoming });
    }

    result.sort((a, b) => a.biomarker.localeCompare(b.biomarker));
    return result;
  }, [pipeline, regimens, drugProfiles, drugWeights]);

  return (
    <div className="oc-main">
      <div className="oc-section-header">
        <div className="oc-section-title">Insights — Current SOC &amp; Incoming Pipeline</div>
        <span className="oc-count">{regimens.length} SOC · {pipeline.length} pipeline</span>
      </div>

      {data.length === 0 ? (
        <div className="oc-empty">No data matches current filters.</div>
      ) : (
        data.map((group) => (
          <div key={group.biomarker} className="in-group">
            <div className="in-group-header">
              <span className={`oc-card-bm ${biomarkerBadgeClass(group.biomarker)}`}>{group.biomarker}</span>
              <span className="in-group-count">{group.regimens.length} regimens · {group.pipeline.length} incoming</span>
            </div>

            <div className="in-group-body">
              {group.regimens.map((r) => {
                const key = `${r.biomarker}||${r.lot}`;
                const incoming = group.pipeline.filter((p) => p.lot === r.lot);

                return (
                  <div key={r.id} className="in-soc-card">
                    <div className="in-soc-header">
                      <span className="in-soc-drug">{r.drug}</span>
                      <span className={`tag ${r.tier === "Preferred" ? "tag-preferred" : r.tier === "UICC" ? "tag-uicc" : "tag-subsequent"}`}>{r.tier}</span>
                      <span className="tag tag-lot">{r.lot}</span>
                      <span className={`tag ${r.type === "Combination" ? "tag-type-combo" : "tag-type-single"}`}>{r.type === "Combination" ? "Combo" : "Single"}</span>
                    </div>
                    <div className="in-soc-detail">{r.drug_class}{r.histology ? ` · ${r.histology}` : ""}</div>

                    {incoming.length > 0 && (
                      <div className="in-pipe-list">
                        <div className="in-pipe-label">Incoming competitors</div>
                        {incoming.map((p) => (
                          <div key={p.nct_id} className="in-pipe-tag">
                            <span className="in-pipe-drug">{p.drug}</span>
                            <span className="in-pipe-horizon" style={{
                              color: p.horizonMo !== null && p.horizonMo < 12 ? "#2d6a4f" : p.horizonMo !== null && p.horizonMo < 36 ? "#e09f3e" : "#d00000",
                            }}>
                              {p.projSOC || "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {group.pipeline.length > 0 && (
              <div className="in-group-pipe-summary">
                <span className="in-group-pipe-label">All incoming for {group.biomarker}:</span>
                {group.pipeline.map((p) => (
                  <span key={p.nct_id} className="in-pipe-chip">
                    {p.drug}
                    <span className="in-pipe-chip-date">{p.projSOC || "—"}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
