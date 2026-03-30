import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pincode = (searchParams.get("pincode") || "").trim();

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ message: "Pincode must be 6 digits" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = (await res.json()) as Array<{
      Status?: string;
      PostOffice?: Array<{ District?: string; State?: string }>;
    }>;

    const record = data?.[0];
    const office = record?.PostOffice?.[0];
    if (!office || record?.Status !== "Success") {
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
