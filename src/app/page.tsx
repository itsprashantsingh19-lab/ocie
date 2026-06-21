import { getDashboardData } from "@/lib/queries";
import { Dashboard } from "@/components/Dashboard";
import type { DashboardData } from "@/types";

export const dynamic = "force-dynamic";

type FetchResult = { ok: true; data: DashboardData } | { ok: false; error: string };

async function fetchDashboardData(): Promise<FetchResult> {
  try {
    const data = await getDashboardData();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error connecting to the database." };
  }
}

export default async function Home() {
  const result = await fetchDashboardData();

  if (!result.ok) {
    return <SetupScreen title="Database not reachable" detail={result.error} />;
  }

  if (result.data.biomarkers.length === 0) {
    return (
      <SetupScreen
        title="Database connected, but empty"
        detail="Run `npm run db:seed` to load data/guideline_mapping.json into Postgres."
      />
    );
  }

  return <Dashboard data={result.data} />;
}

function SetupScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md bg-panel border border-border rounded-lg p-6">
        <h1 className="text-[16px] font-bold text-foreground mb-2">{title}</h1>
        <p className="text-[13px] text-text-dim mb-4">{detail}</p>
        <ol className="text-[12.5px] text-text-dim space-y-1.5 list-decimal pl-4">
          <li>
            Copy <code className="font-mono bg-card-hover px-1 rounded">.env.example</code> to{" "}
            <code className="font-mono bg-card-hover px-1 rounded">.env.local</code> and set{" "}
            <code className="font-mono bg-card-hover px-1 rounded">DATABASE_URL</code>
          </li>
          <li>
            Apply <code className="font-mono bg-card-hover px-1 rounded">db/schema.sql</code> to that database
          </li>
          <li>
            Run <code className="font-mono bg-card-hover px-1 rounded">npm run db:seed</code>
          </li>
          <li>Refresh this page</li>
        </ol>
      </div>
    </div>
  );
}
