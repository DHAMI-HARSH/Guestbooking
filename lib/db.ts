import sql from "mssql";

declare global {
  // eslint-disable-next-line no-var
  var mssqlPool: sql.ConnectionPool | undefined;
}

const config: sql.config = {
  server: process.env.DB_SERVER || "SRHUIT-24-0089",
  user: process.env.DB_USER|| "sa",
  password: process.env.DB_PASSWORD || "sst@12345",
  database: process.env.DB_NAME || "guesthouse",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_CERT !== "false",
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
