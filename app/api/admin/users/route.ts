import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireRoles } from "@/lib/permissions";
import { adminUserSchema } from "@/lib/validation";
import { parsePagination, toPaginationMeta } from "@/lib/pagination";

export const runtime = "nodejs";

function normalizeEcode(value: string) {
  return value.trim().toUpperCase();
}

async function resolveSessionUserId(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  ecode: string,
): Promise<number | null> {
  const result = await pool
    .request()
    .input("ecode", normalizeEcode(ecode))
    .query(`
      SELECT TOP 1 id
      FROM Users
      WHERE UPPER(LTRIM(RTRIM(ecode))) = @ecode
    `);

  const row = result.recordset[0] as { id: number } | undefined;
  return row?.id ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, ["ADMIN"]);

  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const { page, limit, offset } = parsePagination(searchParams);

    const pool = await getDbPool();
    const currentAdminId = await resolveSessionUserId(pool, auth.session.ecode);
    if (!currentAdminId) {
      return NextResponse.json({ message: "Session user no longer exists. Please login again." }, { status: 401 });
    }

    const req = pool.request();
    req.input("offset", offset);
    req.input("limit", limit);
    req.input("created_by_admin_id", currentAdminId);

    const conditions: string[] = ["created_by_admin_id = @created_by_admin_id"];

    if (query && query.trim()) {
      req.input("q_like", `%${query.trim()}%`);
      conditions.push(
        "(" +
          [
            "CAST(id AS NVARCHAR(32)) LIKE @q_like",
            "ecode LIKE @q_like",
            "name LIKE @q_like",
            "department LIKE @q_like",
            "unit LIKE @q_like",
            "role LIKE @q_like",
          ].join(" OR ") +
          ")",
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await req.query(`
      SELECT COUNT(*) AS total
      FROM Users
      ${whereClause}
    `);

    const total = Number((countResult.recordset[0] as { total?: unknown } | undefined)?.total ?? 0);

    const result = await req.query(`
      SELECT
        id,
        ecode,
        name,
        department,
        unit,
        role,
        is_active,
        created_by_admin_id,
        created_at
      FROM Users
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    return NextResponse.json({
      users: result.recordset,
      pagination: toPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to fetch users",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ["ADMIN"]);

  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const parsed = adminUserSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid data", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const pool = await getDbPool();
    const currentAdminId = await resolveSessionUserId(pool, auth.session.ecode);
    if (!currentAdminId) {
      return NextResponse.json({ message: "Session user no longer exists. Please login again." }, { status: 401 });
    }

    const ecode = normalizeEcode(parsed.data.ecode);

    const exists = await pool
      .request()
      .input("ecode", ecode)
      .query(`
        SELECT TOP 1 id
        FROM Users
        WHERE UPPER(LTRIM(RTRIM(ecode))) = @ecode
      `);

    if (exists.recordset.length > 0) {
      return NextResponse.json(
        { message: "Ecode already exists" },
        { status: 409 }
      );
    }

    const req = pool.request();
    req.input("ecode", ecode);
    req.input("name", parsed.data.name.trim());
    req.input("department", parsed.data.department.trim());
    req.input("unit", parsed.data.unit ? parsed.data.unit.trim() : null);
    req.input("role", parsed.data.role);
    req.input("password_hash", parsed.data.password);
    req.input("is_active", parsed.data.is_active ?? true);
    req.input("created_by_admin_id", currentAdminId);

    const result = await req.query(`
      INSERT INTO Users (ecode, name, unit, department, role, password_hash, is_active, created_by_admin_id)
      OUTPUT INSERTED.id, INSERTED.ecode, INSERTED.name, INSERTED.department, INSERTED.unit, INSERTED.role, INSERTED.is_active, INSERTED.created_by_admin_id
      VALUES (@ecode, @name, @unit, @department, @role, @password_hash, @is_active, @created_by_admin_id)
    `);

    return NextResponse.json({
      message: "User created",
      user: result.recordset[0],
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to create user",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
