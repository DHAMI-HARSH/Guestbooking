import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { NextRequest } from "next/server";
import type { SessionUser } from "@/lib/types";

const COOKIE_NAME = "ghms_session";
const DEV_FALLBACK_JWT_SECRET = "dev-only-jwt-secret-change-me";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) {
    return new TextEncoder().encode(secret);
  }

  if (process.env.NODE_ENV !== "production") {
    return new TextEncoder().encode(DEV_FALLBACK_JWT_SECRET);
  }

  throw new Error("JWT_SECRET is missing");
}

export async function signSessionToken(user: SessionUser) {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload.user as SessionUser;
}

export async function getServerSession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getRequestSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}
