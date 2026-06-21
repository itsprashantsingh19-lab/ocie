import type { InsightsData } from "@/lib/dashboard-utils";
import { STATUS_LABEL } from "@/types";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h4 className="text-[12px] uppercase tracking-wide text-text-dim mb-2.5">{title}</h4>
      {children}
    </div>
  );
}

function ListRow({ label, value }: { label: string; value: string | number }) {
  return (
    <li className="flex justify-between py-1.5 border-b border-border-soft last:border-b-0 text-[12.5px]">
      <span>{label}</span>
      <span className="font-mono text-text-dim">{value}</span>
    </li>
  );
}

interface InsightsPanelProps {
  insights: InsightsData;
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  return (
    <div className="px-6 pb-6 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      <Card title="Biomarkers by track">
        <ul>
          {insights.byTrack.map((t) => (
            <ListRow key={t.track} label={t.track} value={t.count} />
          ))}
        </ul>
      </Card>

      <Card title="Drugs by status (deduped)">
        <ul>
          {insights.byStatus.map((s) => (
            <ListRow key={s.status} label={STATUS_LABEL[s.status]} value={s.count} />
          ))}
        </ul>
      </Card>

      <Card title="Evidence trial roster (NLP-extracted)">
        <ul>
          {insights.evidenceTrials.length ? (
            insights.evidenceTrials.map((t) => <ListRow key={t} label={t} value="mentioned" />)
          ) : (
            <li className="text-text-faint text-[12.5px] py-1.5">None extracted yet</li>
          )}
        </ul>
      </Card>

      <Card title="Data quality flags">
        <ul>
          <ListRow label="Pipeline biomarkers unmatched to a guideline entity" value={insights.unmatchedBiomarkers} />
        </ul>
      </Card>
    </div>
  );
}
