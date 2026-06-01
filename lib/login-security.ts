import type { DbPool } from "@/lib/db";

type LoginSecurityRow = {
  subject_key: string;
  ecode: string | null;
  ip_address: string;
  attempt_count: number;
  warning_count: number;
  banned_until: Date | null;
};

const ATTEMPTS_PER_WARNING = 5;
const WARNINGS_PER_BAN = 3;
const BAN_DURATION_MS = 60 * 1000;

let ensureTablePromise: Promise<void> | null = null;

export function normalizeClientIp(value: string | null) {
  if (!value) return "unknown";
  return value.split(",")[0]?.trim() || "unknown";
}

export function buildLoginSubjectKey(ipAddress: string, ecode?: string | null) {
  const normalizedEcode = ecode?.trim().toUpperCase();

  if (normalizedEcode) {
    return `${normalizedEcode}:${ipAddress}`;
  }

  return ipAddress;
}

export async function ensureLoginSecurityTable(pool: DbPool) {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await pool.request().query(`
        CREATE TABLE IF NOT EXISTS login_security (
          subject_key VARCHAR(128) PRIMARY KEY,
          ecode VARCHAR(20) NULL,
          ip_address VARCHAR(128) NOT NULL,
          attempt_count INT NOT NULL DEFAULT 0,
          warning_count INT NOT NULL DEFAULT 0,
          banned_until TIMESTAMPTZ NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.request().query(`
        ALTER TABLE login_security
          ADD COLUMN IF NOT EXISTS ecode VARCHAR(20)
      `);
      await pool.request().query(`
        ALTER TABLE login_security
          ADD COLUMN IF NOT EXISTS ip_address VARCHAR(128) NOT NULL DEFAULT 'unknown'
      `);
      await pool.request().query(`
        ALTER TABLE login_security
          ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0
      `);
      await pool.request().query(`
        ALTER TABLE login_security
          ADD COLUMN IF NOT EXISTS warning_count INT NOT NULL DEFAULT 0
      `);
      await pool.request().query(`
        ALTER TABLE login_security
          ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ NULL
      `);
      await pool.request().query(`
        ALTER TABLE login_security
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);
      await pool.request().query(`
        ALTER TABLE login_security
          ALTER COLUMN ecode DROP NOT NULL
      `);
      await pool.request().query(`
        UPDATE login_security
        SET ecode = COALESCE(NULLIF(ecode, ''), 'unknown')
      `);
    })().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return await ensureTablePromise;
}

export async function getLoginSecurityState(pool: DbPool, subjectKey: string) {
  await ensureLoginSecurityTable(pool);

  const result = await pool
    .request()
    .input("subject_key", subjectKey)
    .query(`
      SELECT
        subject_key,
        ecode,
        ip_address,
        attempt_count,
        warning_count,
        banned_until
      FROM login_security
      WHERE subject_key = @subject_key
      LIMIT 1
    `);

  return (result.recordset[0] as LoginSecurityRow | undefined) ?? null;
}

export async function clearLoginSecurityState(pool: DbPool, subjectKey: string) {
  await ensureLoginSecurityTable(pool);

  await pool
    .request()
    .input("subject_key", subjectKey)
    .query(`
      DELETE FROM login_security
      WHERE subject_key = @subject_key
    `);
}

export async function recordLoginAttempt(
  pool: DbPool,
  input: { subjectKey: string; ipAddress: string; ecode?: string | null },
) {
  await ensureLoginSecurityTable(pool);

  const current = await getLoginSecurityState(pool, input.subjectKey);
  const now = new Date();
  const currentlyBanned = current?.banned_until ? new Date(current.banned_until).getTime() > now.getTime() : false;

  const nextAttemptCount = (current?.attempt_count ?? 0) + 1;
  let nextWarningCount = current?.warning_count ?? 0;
  let bannedUntil = current?.banned_until ?? null;
  let warningMessage: string | null = null;

  if (currentlyBanned && bannedUntil) {
    return {
      status: "banned" as const,
      bannedUntil,
      retryAfterSeconds: Math.max(1, Math.ceil((new Date(bannedUntil).getTime() - now.getTime()) / 1000)),
      warningMessage: null,
    };
  }

  if (nextAttemptCount % ATTEMPTS_PER_WARNING === 0) {
    nextWarningCount += 1;
    warningMessage = `Warning ${nextWarningCount}/${WARNINGS_PER_BAN}: ${ATTEMPTS_PER_WARNING} sign-in clicks detected.`;
  }

  if (nextWarningCount >= WARNINGS_PER_BAN) {
    bannedUntil = new Date(now.getTime() + BAN_DURATION_MS);
    nextWarningCount = 0;
  }

  await pool
    .request()
    .input("subject_key", input.subjectKey)
    .input("ecode", input.ecode?.trim() || "unknown")
    .input("ip_address", input.ipAddress)
    .input("attempt_count", bannedUntil ? 0 : nextAttemptCount)
    .input("warning_count", nextWarningCount)
    .input("banned_until", bannedUntil)
    .query(`
      INSERT INTO login_security (
        subject_key,
        ecode,
        ip_address,
        attempt_count,
        warning_count,
        banned_until,
        updated_at
      )
      VALUES (
        @subject_key,
        @ecode,
        @ip_address,
        @attempt_count,
        @warning_count,
        @banned_until,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (subject_key)
      DO UPDATE SET
        ecode = EXCLUDED.ecode,
        ip_address = EXCLUDED.ip_address,
        attempt_count = EXCLUDED.attempt_count,
        warning_count = EXCLUDED.warning_count,
        banned_until = EXCLUDED.banned_until,
        updated_at = CURRENT_TIMESTAMP
    `);

  if (bannedUntil) {
    return {
      status: "banned" as const,
      bannedUntil,
      retryAfterSeconds: Math.max(1, Math.ceil((bannedUntil.getTime() - now.getTime()) / 1000)),
      warningMessage,
    };
  }

  if (warningMessage) {
    return {
      status: "warning" as const,
      warningMessage,
      warningCount: nextWarningCount,
    };
  }

  return {
    status: "tracking" as const,
  };
}

export async function resetLoginSecurityState(pool: DbPool, subjectKey: string) {
  await ensureLoginSecurityTable(pool);

  await pool
    .request()
    .input("subject_key", subjectKey)
    .query(`
      UPDATE login_security
      SET
        attempt_count = 0,
        warning_count = 0,
        banned_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE subject_key = @subject_key
    `);
}
