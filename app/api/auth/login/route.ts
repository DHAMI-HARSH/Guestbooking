import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDbPool } from "@/lib/db";
import { getSessionCookieName, signSessionToken } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

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

    if (!ecode || !password) {
      return NextResponse.json(
        { message: "Invalid input: ecode and password are required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

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
