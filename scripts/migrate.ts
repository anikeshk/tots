import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";

// Applies every db/migrations/*.sql file in order. Each file is idempotent.
const dir = join(import.meta.dirname, "..", "db", "migrations");
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });

for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
  await pool.query(await readFile(join(dir, file), "utf8"));
  console.log(`applied ${file}`);
}
await pool.end();
