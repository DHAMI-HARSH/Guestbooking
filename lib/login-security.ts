import type { DbPool } from "@/lib/db";

type LoginSecurityRow = {
  subject_key: string;
  ecode: string;
  ip_address: string;
  failed_attempts: number;
  warning_count: number;
  banned_until: Date | null;
};

const BAN_DURATION_MS = 60 * 1000;
const FAILURES_PER_WARNING = 5;
const WARNINGS_PER_BAN = 3;

let ensureTablePromise: Promise<void> | null = null;

export function normalizeClientIp(value: string | null) {
  if (!value) return "unknown";
  return value.split(",")[0]?.trim() || "unknown";
}

export function buildLoginSubjectKey(ecode: string, ipAddress: string) {
  return `${ipAddress}:${ecode}`;
}

export async function ensureLoginSecurityTable(pool: DbPool) {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await pool.request().query(`
        CREATE TABLE IF NOT EXISTS login_security (
          subject_key VARCHAR(320) PRIMARY KEY,
          ecode VARCHAR(20) NOT NULL,
          ip_address VARCHAR(128) NOT NULL,
          failed_attempts INT NOT NULL DEFAULT 0,
          warning_count INT NOT NULL DEFAULT 0,
          banned_until TIMESTAMPTZ NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
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
        failed_attempts,
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

export async function recordFailedLoginAttempt(
  pool: DbPool,
  input: { subjectKey: string; ecode: string; ipAddress: string },
) {
  await ensureLoginSecurityTable(pool);

  const current = await getLoginSecurityState(pool, input.subjectKey);
  const now = new Date();
  const currentlyBanned = current?.banned_until ? new Date(current.banned_until) > now : false;

  const failedAttempts = (current?.failed_attempts ?? 0) + 1;
  let warningCount = current?.warning_count ?? 0;
  let bannedUntil: Date | null = current?.banned_until ?? null;
  let warningMessage: string | null = null;
  let isBanned = currentlyBanned;

  if (currentlyBanned && bannedUntil) {
    return {
      status: "banned" as const,
      bannedUntil,
      retryAfterSeconds: Math.max(1, Math.ceil((new Date(bannedUntil).getTime() - now.getTime()) / 1000)),
      warningMessage: null,
    };
  }

  if (failedAttempts >= FAILURES_PER_WARNING) {
    warningCount += 1;
    warningMessage = `Warning ${warningCount}/${WARNINGS_PER_BAN}: ${FAILURES_PER_WARNING} failed login attempts detected.`;
  }

  if (warningCount >= WARNINGS_PER_BAN) {
    bannedUntil = new Date(now.getTime() + BAN_DURATION_MS);
    warningCount = 0;
    isBanned = true;
  }

  await pool
    .request()
    .input("subject_key", input.subjectKey)
    .input("ecode", input.ecode)
    .input("ip_address", input.ipAddress)
    .input("failed_attempts", warningCount === 0 || isBanned ? 0 : failedAttempts % FAILURES_PER_WARNING)
    .input("warning_count", warningCount)
    .input("banned_until", bannedUntil)
    .query(`
      INSERT INTO login_security (
        subject_key,
        ecode,
        ip_address,
        failed_attempts,
        warning_count,
        banned_until,
        updated_at
      )
      VALUES (
        @subject_key,
        @ecode,
        @ip_address,
        @failed_attempts,
        @warning_count,
        @banned_until,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (subject_key)
      DO UPDATE SET
        ecode = EXCLUDED.ecode,
        ip_address = EXCLUDED.ip_address,
        failed_attempts = EXCLUDED.failed_attempts,
        warning_count = EXCLUDED.warning_count,
        banned_until = EXCLUDED.banned_until,
        updated_at = CURRENT_TIMESTAMP
    `);

  if (isBanned && bannedUntil) {
    return {
      status: "banned" as const,
      bannedUntil,
      retryAfterSeconds: Math.max(1, Math.ceil((bannedUntil.getTime() - now.getTime()) / 1000)),
      warningMessage,
    };
  }

  return {
    status: "warning" as const,
    warningCount,
    warningMessage,
  };
}
