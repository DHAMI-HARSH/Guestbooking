import { NextRequest } from "next/server";
import { getRequestSession } from "@/lib/auth";
import type { Role, SessionUser } from "@/lib/types";

export async function requireRoles(req: NextRequest, roles: Role[]) {
  const session = await getRequestSession(req);
  if (!session) {
    return { session: null, authorized: false as const };
  }
  if (session.role === "ADMIN") {
    return { session, authorized: true as const };
  }
  if (!roles.includes(session.role)) {
    return { session: null, authorized: false as const };
  }
  return { session, authorized: true as const };
}

export function canManageBooking(session: SessionUser, bookingCreatorId: number) {
  if (session.role === "ESTATE_PRIMARY" || session.role === "ADMIN") {
    return true;
  }
  return session.id === bookingCreatorId;
}
