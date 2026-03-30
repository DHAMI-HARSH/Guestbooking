import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.json({ message: "Logged out" });
  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    new URL(request.url).protocol === "https:";

  response.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
