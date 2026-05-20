import { NextRequest, NextResponse } from "next/server";
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

    const updates: string[] = [];
    const pool = await getDbPool();
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
      // NOTE: Current system uses `password_hash` as a password field (plain-text comparison in login).
      // We keep the existing behavior and treat this as a password reset.
      updates.push("password_hash = @password_hash");
      req.input("password_hash", parsed.data.password);
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No changes provided" }, { status: 400 });
    }

    const result = await req.query(`
      UPDATE Users
      SET ${updates.join(", ")}
      OUTPUT INSERTED.id, INSERTED.ecode, INSERTED.name, INSERTED.department, INSERTED.unit, INSERTED.role, INSERTED.is_active, INSERTED.created_at
      WHERE id = @id
    `);

    const updated = result.recordset[0];
    if (!updated) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "User updated", user: updated });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to update user", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

