import sql from "mssql";

declare global {
  // eslint-disable-next-line no-var
  var mssqlPool: sql.ConnectionPool | undefined;
}

function envBool(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

const config: sql.config = {
  server: process.env.DB_SERVER || "(localdb)\\MSSQLLocalDB",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "guesthouse",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,

  options: {
    encrypt: envBool(process.env.DB_ENCRYPT, false),
    trustServerCertificate: envBool(process.env.DB_TRUST_CERT, true),
  },

  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

export async function getDbPool() {
  if (!global.mssqlPool) {
    global.mssqlPool = await new sql.ConnectionPool(config).connect();
  }
  return global.mssqlPool;
}

export { sql };
