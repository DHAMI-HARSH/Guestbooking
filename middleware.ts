import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import type { Role } from "@/lib/types";

const SESSION_COOKIE = "ghms_session";
const DEV_FALLBACK_JWT_SECRET = "dev-only-jwt-secret-change-me";

const rolePathMap: Record<string, Role[]> = {
  "/dashboard/employee": ["EMPLOYEE"],
  "/dashboard/approver": ["APPROVER"],
  "/dashboard/estate-primary": ["ESTATE_PRIMARY"],
  "/dashboard/room-allocation": ["ESTATE_PRIMARY"],
  "/dashboard/admin": ["ADMIN"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:";

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api")) {
      const response = NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      response.cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
      return response;
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  }

  try {
    const secret = process.env.JWT_SECRET?.trim();
    const resolvedSecret =
      secret || (process.env.NODE_ENV !== "production" ? DEV_FALLBACK_JWT_SECRET : undefined);

    if (!resolvedSecret) {
      return NextResponse.json({ message: "Server misconfigured: JWT_SECRET is missing" }, { status: 500 });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(resolvedSecret));
    const user = payload.user as { role: Role };
    const roleRule = Object.entries(rolePathMap).find(([route]) => pathname.startsWith(route));
    if (roleRule && !roleRule[1].includes(user.role) && user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api")) {
      const response = NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      response.cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
      return response;
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/"],
};
