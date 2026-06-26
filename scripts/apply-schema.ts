import { readFileSync } from "fs";
import { Pool } from "pg";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../.env.local") });

async function applySchema() {
  const sql = readFileSync(path.resolve(__dirname, "../db/schema.sql"), "utf-8");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Applying schema...");
  await pool.query(sql);
  console.log("Schema applied!");
  await pool.end();
}

applySchema().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
