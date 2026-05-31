import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDbPool } from "@/lib/db";
import { requireRoles } from "@/lib/permissions";
import { adminUserUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(request, ["ADMIN"]);
  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(params.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const parsed = adminUserUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    }

    const pool = await getDbPool();
    const creatorResult = await pool
      .request()
      .input("id", userId)
      .query(`
        SELECT created_by_admin_id
        FROM users
        WHERE id = @id
        LIMIT 1
      `);

    const target = creatorResult.recordset[0] as { created_by_admin_id?: number | null } | undefined;
    if (!target) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    if (target.created_by_admin_id !== null && target.created_by_admin_id !== auth.session.id) {
      return NextResponse.json({ message: "You can only update accounts you created" }, { status: 403 });
    }

    const updates: string[] = [];
    const req = pool.request();
    req.input("id", userId);

    if (typeof parsed.data.role === "string") {
      updates.push("role = @role");
      req.input("role", parsed.data.role);
    }

    if (typeof parsed.data.is_active === "boolean") {
      updates.push("is_active = @is_active");
      req.input("is_active", parsed.data.is_active);
    }

    if (typeof parsed.data.password === "string" && parsed.data.password.trim().length > 0) {
      updates.push("password_hash = @password_hash");
      req.input("password_hash", await bcrypt.hash(parsed.data.password, 10));
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No changes provided" }, { status: 400 });
    }

    const result = await req.query(`
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = @id
      RETURNING id, ecode, name, department, unit, role, is_active, created_by_admin_id, created_at
    `);

    const updated = result.recordset[0];
    return NextResponse.json({ message: "User updated", user: updated });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to update user", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
