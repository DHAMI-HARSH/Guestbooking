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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pincode = (searchParams.get("pincode") || "").trim();

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ message: "Pincode must be 6 digits" }, { status: 400 });
  }

  try {
    const res = await fetchWithTimeout(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = (await res.json()) as Array<{
      Status?: string;
      PostOffice?: Array<{ District?: string; State?: string }>;
    }>;

    const record = data?.[0];
    const office = record?.PostOffice?.[0];
    if (!office || record?.Status !== "Success") {
      const fallbackRes = await fetchWithTimeout(`https://api.zippopotam.us/in/${pincode}`);
      if (fallbackRes.ok) {
        const fallback = (await fallbackRes.json()) as {
          places?: Array<{ "place name"?: string; state?: string }>;
        };
        const fallbackPlace = fallback?.places?.[0];
        if (fallbackPlace) {
          return NextResponse.json({
            city: fallbackPlace["place name"] || "",
            state: fallbackPlace.state || "",
          });
        }
      }

      return NextResponse.json({ message: "Pincode not found" }, { status: 404 });
    }

    return NextResponse.json({
      city: office.District || "",
      state: office.State || "",
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to lookup pincode", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
