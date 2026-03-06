import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getDbPool, sql } from "@/lib/db";
import { getSessionCookieName, signSessionToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import type { SessionUser } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
    }

    const pool = await getDbPool();
    const result = await pool
      .request()
      .input("ecode", sql.VarChar(20), parsed.data.ecode)
      .query(
        "SELECT TOP 1 id, ecode, name, department, unit, role, password_hash FROM Users WHERE ecode = @ecode AND is_active = 1",
      );

    const user = result.recordset[0];
    if (!user) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
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
    const response = NextResponse.json({ message: "Login success", user: sessionUser });
    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        message: process.env.NODE_ENV === "production" ? "Login failed" : `Login failed: ${detail}`,
        detail,
      },
      { status: 500 },
    );
  }
}
