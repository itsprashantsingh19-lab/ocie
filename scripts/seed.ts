/**
 * scripts/seed.ts
 *
 * Loads data/guideline_mapping.json (output of scripts/parse_guidelines.py)
 * into Postgres. Run after applying db/schema.sql.
 *
 * Usage:
 *   npm run db:seed
 *
 * Re-running is safe — it truncates and reloads all three tables each time,
 * so this is also how you refresh the DB after re-running the Python parser
 * on an updated xlsx.
 */

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

// Next.js auto-loads .env.local; plain Node scripts run via tsx don't, so
// load it explicitly here (falling back to .env if .env.local isn't present).
const envLocal = join(process.cwd(), ".env.local");
loadEnv({ path: existsSync(envLocal) ? envLocal : join(process.cwd(), ".env") });

interface SeedBiomarker {
  id: string;
  name: string;
  track: string;
  incidence_pct: string | null;
  notes: string | null;
  notable_trials: string[];
}

interface SeedDrug {
  id: string;
  display_name: string;
  drug_class: string | null;
  mechanism: string | null;
  source: string;
  occurrences: SeedOccurrence[];
}

interface SeedOccurrence {
  biomarker_id: string;
  track: string;
  line: string;
  status: string;
  status_detail?: string;
  raw_text: string | null;
  histology?: string | null;
  setting?: string | null;
  route?: string | null;
  safety_notes?: string | null;
  evidence_trials?: string[];
}

interface SeedFile {
  biomarkers: SeedBiomarker[];
  drugs: SeedDrug[];
  meta: Record<string, unknown>;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  }

  const dataPath = join(process.cwd(), "data", "guideline_mapping.json");
  const seed: SeedFile = JSON.parse(readFileSync(dataPath, "utf-8"));

  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query("begin");

    await client.query("truncate occurrences, drugs, biomarkers restart identity cascade");

    for (const b of seed.biomarkers) {
      await client.query(
        `insert into biomarkers (id, name, track, incidence_pct, notes, notable_trials)
         values ($1, $2, $3, $4, $5, $6)`,
        [b.id, b.name, b.track, b.incidence_pct, b.notes, b.notable_trials ?? []]
      );
    }
    console.log(`Inserted ${seed.biomarkers.length} biomarkers`);

    let occurrenceCount = 0;
    for (const d of seed.drugs) {
      await client.query(
        `insert into drugs (id, display_name, drug_class, mechanism, source)
         values ($1, $2, $3, $4, $5)`,
        [d.id, d.display_name, d.drug_class, d.mechanism, d.source]
      );

      for (const o of d.occurrences) {
        await client.query(
          `insert into occurrences
             (drug_id, biomarker_id, track, line, status, status_detail, raw_text,
              histology, setting, route, safety_notes, evidence_trials)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            d.id,
            o.biomarker_id,
            o.track,
            o.line,
            o.status,
            o.status_detail ?? null,
            o.raw_text,
            o.histology ?? null,
            o.setting ?? null,
            o.route ?? null,
            o.safety_notes ?? null,
            o.evidence_trials ?? [],
          ]
        );
        occurrenceCount += 1;
      }
    }
    console.log(`Inserted ${seed.drugs.length} drugs, ${occurrenceCount} occurrences`);

    await client.query("commit");
    console.log("Seed complete.");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
