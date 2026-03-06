import { NextRequest } from "next/server";
import { getRequestSession } from "@/lib/auth";
import type { Role, SessionUser } from "@/lib/types";

export async function requireRoles(req: NextRequest, roles: Role[]) {
  const session = await getRequestSession(req);
  if (!session || !roles.includes(session.role)) {
    return { session: null, authorized: false as const };
  }
  return { session, authorized: true as const };
}

export function canManageBooking(session: SessionUser, bookingCreatorId: number) {
  if (session.role === "ESTATE_PRIMARY" || session.role === "ESTATE_SECONDARY") {
    return true;
  }
  return session.id === bookingCreatorId;
}
