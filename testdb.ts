import { Pool } from "pg";

async function test() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await pool.query("SELECT 1 AS ok");
    console.log("DB Connected");
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await pool.end();
  }
}

test();
