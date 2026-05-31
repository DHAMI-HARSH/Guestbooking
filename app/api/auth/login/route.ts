import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDbPool } from "@/lib/db";
import { getSessionCookieName, signSessionToken } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import {
  ensureLoginSecurityTable,
  getLoginSecurityState,
  normalizeClientIp,
  recordLoginAttempt,
  resetLoginSecurityState,
  buildLoginSubjectKey,
} from "@/lib/login-security";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

function normalizeEcode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizePassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

async function matchesPassword(stored: string, candidate: string) {
  const normalizedStored = stored.trim();

  if (/^\$2[aby]\$/.test(normalizedStored)) {
    return await bcrypt.compare(candidate, normalizedStored);
  }

  return normalizedStored === candidate;
}

function asDevErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") return undefined;
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const payload =
      body && typeof body === "object"
        ? (body as { ecode?: unknown; password?: unknown })
        : {};

    const ecode = normalizeEcode(payload.ecode);
    const password = normalizePassword(payload.password);
    const turnstileToken =
      typeof (payload as { "cf-turnstile-response"?: unknown })["cf-turnstile-response"] === "string"
        ? ((payload as { "cf-turnstile-response": string })["cf-turnstile-response"] as string)
        : null;

    if (!ecode || !password) {
      // keep going so the submit click still counts toward the security threshold
    }

    const pool = await getDbPool();
    await ensureLoginSecurityTable(pool);

    const clientIp = normalizeClientIp(
        request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip"),
    );
    const subjectKey = buildLoginSubjectKey(clientIp);
    const securityState = await getLoginSecurityState(pool, subjectKey);

    if (securityState?.banned_until && new Date(securityState.banned_until).getTime() > Date.now()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((new Date(securityState.banned_until).getTime() - Date.now()) / 1000),
      );

      return NextResponse.json(
        {
          message: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
          retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const loginAttempt = await recordLoginAttempt(pool, {
      subjectKey,
      ipAddress: clientIp,
      ecode,
    });

    if (loginAttempt.status === "banned") {
      return NextResponse.json(
        {
          message: "Too many sign-in clicks. Try again in 1 minute.",
          retryAfterSeconds: loginAttempt.retryAfterSeconds,
          warning: loginAttempt.warningMessage,
        },
        { status: 429 }
      );
    }

    if (loginAttempt.status === "warning") {
      return NextResponse.json(
        {
          message: loginAttempt.warningMessage || "Warning: repeated sign-in clicks detected.",
          warning: loginAttempt.warningMessage,
        },
        { status: 429 }
      );
    }

    if (!ecode || !password) {
      return NextResponse.json(
        { message: "Invalid input: ecode and password are required" },
        { status: 400 }
      );
    }

    const turnstileResult = await verifyTurnstileToken({
      token: turnstileToken || "",
      remoteIp: clientIp,
      action: "login",
    });

    if (!turnstileResult.success) {
      console.warn("[auth/login] Captcha verification failed", {
        ecode,
        captchaErrors: "errors" in turnstileResult ? turnstileResult.errors : [],
      });
      return NextResponse.json(
        {
          message: "Captcha verification failed. Please try again.",
          captchaErrors: "errors" in turnstileResult ? turnstileResult.errors : [],
        },
        { status: 400 }
      );
    }

    const result = await pool.request().input("ecode", ecode).query(`
      SELECT
        id,
        ecode,
        name,
        department,
        unit,
        role,
        password_hash,
        is_active
      FROM users
      WHERE UPPER(LTRIM(RTRIM(ecode))) = @ecode
      LIMIT 1
    `);

    const user = result.recordset[0] as
      | {
          id: number;
          ecode: string;
          name: string;
          department: string;
          unit: string | null;
          role: SessionUser["role"];
          password_hash: string;
          is_active: boolean;
        }
      | undefined;

    if (!user || user.is_active === false) {
      console.warn("[auth/login] Invalid credentials", {
        ecode,
        userFound: false,
      });

      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    const validPassword = await matchesPassword(user.password_hash, password);
    if (!validPassword) {
      console.warn("[auth/login] Invalid credentials", {
        ecode,
        userFound: Boolean(user),
      });

      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    const sessionUser: SessionUser = {
      id: user.id,
      ecode: user.ecode,
      name: user.name,
      department: user.department,
      unit: user.unit,
      role: user.role,
    };

    const token = await signSessionToken(sessionUser);

    await resetLoginSecurityState(pool, subjectKey);

    const response = NextResponse.json({
      message: "Login success",
      user: sessionUser,
    });

    const isHttps =
      request.headers.get("x-forwarded-proto") === "https" ||
      new URL(request.url).protocol === "https:";

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    console.error("[auth/login] Database/login error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { message: "Database error", detail: asDevErrorMessage(error) },
      { status: 500 }
    );
  }
}
