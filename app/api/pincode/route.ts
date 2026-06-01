import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupPostalApi(pincode: string) {
  const res = await fetchWithTimeout(`https://api.postalpincode.in/pincode/${pincode}`);
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    Status?: string;
    PostOffice?: Array<{ District?: string; State?: string }>;
  }>;

  const record = data?.[0];
  const office = record?.PostOffice?.[0];
  if (!office || record?.Status !== "Success") return null;

  return {
    city: office.District || "",
    state: office.State || "",
  };
}

async function lookupFallbackApi(pincode: string) {
  const res = await fetchWithTimeout(`https://api.zippopotam.us/in/${pincode}`);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    places?: Array<{ "place name"?: string; state?: string }>;
  };
  const place = data?.places?.[0];
  if (!place) return null;

  return {
    city: place["place name"] || "",
    state: place.state || "",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pincode = (searchParams.get("pincode") || "").trim();

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ message: "Pincode must be 6 digits" }, { status: 400 });
  }

  try {
    const primary = await lookupPostalApi(pincode).catch(() => null);
    if (primary) {
      return NextResponse.json(primary);
    }

    const fallback = await lookupFallbackApi(pincode).catch(() => null);
    if (fallback) {
      return NextResponse.json(fallback);
    }

    return NextResponse.json({ message: "Pincode not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to lookup pincode", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
