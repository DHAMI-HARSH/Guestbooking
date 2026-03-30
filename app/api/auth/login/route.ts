import { NextResponse } from "next/server";
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

    const columnsResult = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Users'
    `);

    const userColumns = new Set(
      columnsResult.recordset.map((row: { COLUMN_NAME: string }) =>
        row.COLUMN_NAME.toLowerCase()
      )
    );

    const requiredColumns = ["id", "ecode", "role", "password_hash"];
    const missingRequired = requiredColumns.filter((c) => !userColumns.has(c));
    if (missingRequired.length > 0) {
      console.error("[auth/login] Users schema mismatch", {
        missingRequired,
      });
      return NextResponse.json(
        {
          message: "Database schema mismatch",
          detail:
            process.env.NODE_ENV === "production"
              ? undefined
              : `Missing Users columns: ${missingRequired.join(", ")}`,
        },
        { status: 500 }
      );
    }

    const query = pool.request();
    query.input("ecode", ecode);
    query.input("password", password);

    const hasIsActive = userColumns.has("is_active");
    const hasName = userColumns.has("name");
    const hasDepartment = userColumns.has("department");
    const hasUnit = userColumns.has("unit");

    if (hasIsActive) {
      query.input("is_active", true);
    }

    const resultWithStatus = await query.query(`
      SELECT TOP 1
        id,
        ecode,
        ${hasName ? "name" : "CAST('' AS NVARCHAR(120)) AS name"},
        ${
          hasDepartment
            ? "department"
            : "CAST('' AS NVARCHAR(120)) AS department"
        },
        ${hasUnit ? "unit" : "CAST(NULL AS NVARCHAR(120)) AS unit"},
        role
      FROM Users
      WHERE UPPER(LTRIM(RTRIM(ecode))) = @ecode
      AND password_hash = @password
      ${hasIsActive ? "AND is_active = @is_active" : ""}
    `);

    const user = resultWithStatus.recordset[0] as
      | {
          id: number;
          ecode: string;
          name: string;
          department: string;
          unit: string | null;
          role: SessionUser["role"];
        }
      | undefined;

    if (!user) {
      console.warn("[auth/login] Invalid credentials", {
        ecode,
        userFound: false,
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
