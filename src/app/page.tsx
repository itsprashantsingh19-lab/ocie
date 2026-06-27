import { getDashboardData } from "@/lib/db";
import DashboardClient from "@/components/Dashboard";
import type { PipelineProfile } from "@/types";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function loadPipelineProfiles(): PipelineProfile[] | null {
  try {
    const p = path.join(process.cwd(), "data", "pipeline_dashboard.json");
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (!raw.pipeline?.length && !raw.approved?.length) return null;
    // Merge pipeline + approved into a single map by nctId
    const all: PipelineProfile[] = [...(raw.pipeline || []), ...(raw.approved || [])];
    return all;
  } catch {
    return null;
  }
}

export default async function Page() {
  let data;
  let error: string | null = null;

  try {
    data = await getDashboardData();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load data";
  }

  const pipelineProfiles = loadPipelineProfiles();

  return <DashboardClient data={data ? { ...data, pipelineProfiles: pipelineProfiles ?? undefined } : null} error={error} />;
}
