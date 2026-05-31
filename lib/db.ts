import { Pool, PoolClient, type PoolConfig, type QueryResult } from "pg";

type DbInputValue = unknown;

type DbResult<T = Record<string, unknown>> = {
  recordset: T[];
  rowsAffected: number[];
};

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

function envBool(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "require"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "disable"].includes(normalized)) return false;
  return fallback;
}

async function createPool() {
  const sslRequired = envBool(process.env.DB_SSL, false);
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || undefined;
  const host = process.env.DB_HOST || process.env.PGHOST;
  const user = process.env.DB_USER || process.env.PGUSER;
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD;
  const database = process.env.DB_NAME || process.env.PGDATABASE;
  const port = process.env.DB_PORT
    ? Number(process.env.DB_PORT)
    : process.env.PGPORT
      ? Number(process.env.PGPORT)
      : 5432;
  const baseOptions = {
    ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
  } as const;

  if (connectionString) {
    const config: PoolConfig = {
      connectionString,
      ...baseOptions,
    };
    return new Pool(config);
  }

  if (host || user || password || database) {
    const config: PoolConfig = {
      host: host || "localhost",
      port,
      user,
      password,
      database: database || "guestbooking",
      ...baseOptions,
    };
    return new Pool(config);
  }

  throw new Error(
    "Database configuration is missing. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME.",
  );
}

function normalizeSql(text: string) {
  return text
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/OUTPUT\s+INSERTED\.\*/gi, "RETURNING *")
    .replace(
      /OUTPUT\s+INSERTED\.([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*INSERTED\.[A-Za-z_][A-Za-z0-9_]*)*)/gi,
      (_match, columns: string) => `RETURNING ${columns.replace(/INSERTED\./gi, "")}`,
    )
    .replace(
      /OFFSET\s+@offset\s+ROWS\s+FETCH\s+NEXT\s+@limit\s+ROWS\s+ONLY/gi,
      "LIMIT @limit OFFSET @offset",
    );
}

function bindParams(text: string, inputs: Map<string, DbInputValue>) {
  const values: DbInputValue[] = [];
  const placeholders = new Map<string, number>();

  const translated = normalizeSql(text).replace(
    /@([A-Za-z_][A-Za-z0-9_]*)/g,
    (_match, name: string) => {
      if (!placeholders.has(name)) {
        placeholders.set(name, values.length + 1);
        values.push(inputs.has(name) ? inputs.get(name) : null);
      }
      return `$${placeholders.get(name)}`;
    },
  );

  return { text: translated, values };
}

async function runQuery(
  executor: (text: string, values: DbInputValue[]) => Promise<QueryResult>,
  text: string,
  inputs: Map<string, DbInputValue>,
): Promise<DbResult> {
  const { text: sqlText, values } = bindParams(text, inputs);
  const result = await executor(sqlText, values);
  return {
    recordset: result.rows as Record<string, unknown>[],
    rowsAffected: result.rowCount !== null ? [result.rowCount] : [],
  };
}

class DbRequest {
  private readonly inputs = new Map<string, DbInputValue>();

  constructor(private readonly executor: (text: string, values: DbInputValue[]) => Promise<QueryResult>) {}

  input(name: string, value: DbInputValue) {
    this.inputs.set(name, value);
    return this;
  }

  async query(text: string) {
    return await runQuery(this.executor, text, this.inputs);
  }
}

class DbTransaction {
  private started = false;
  private released = false;
  private client: PoolClient | null = null;
  private clientPromise: Promise<PoolClient> | null = null;

  constructor(private readonly pool: Pool) {}

  private async getClient() {
    if (this.client) {
      return this.client;
    }

    if (!this.clientPromise) {
      this.clientPromise = this.pool.connect().then((client) => {
        this.client = client;
        return client;
      });
    }

    return await this.clientPromise;
  }

  private release() {
    if (!this.released && this.client) {
      this.client.release();
      this.released = true;
    }
  }

  async begin() {
    if (this.started) return;
    const client = await this.getClient();
    await client.query("BEGIN");
    this.started = true;
  }

  async commit() {
    if (!this.started) return;
    try {
      const client = await this.getClient();
      await client.query("COMMIT");
    } finally {
      this.started = false;
      this.release();
    }
  }

  async rollback() {
    if (!this.started) return;
    try {
      const client = await this.getClient();
      await client.query("ROLLBACK");
    } finally {
      this.started = false;
      this.release();
    }
  }

  request() {
    return new DbRequest((text, values) => this.getClient().then((client) => client.query(text, values)));
  }
}

class DbPool {
  constructor(private readonly pool: Pool) {}

  request() {
    return new DbRequest((text, values) => this.pool.query(text, values));
  }

  transaction() {
    return new DbTransaction(this.pool);
  }
}

export async function getDbPool() {
  if (!global.pgPool) {
    global.pgPool = await createPool();
  }

  return new DbPool(global.pgPool);
}

export type { DbResult };
