import { NextRequest, NextResponse } from "next/server";

// Allowed endpoints to proxy
const ALLOWED = new Set([
  "by-circuit",
  "by-shift",
  "dates",
  "hourly",
  "hourly-combined",
  "missions-hourly",
  "operator-hourly",
  "operators",
  "summary",
  "summary-tables",
  "time-window-operators",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug.join("/");

  if (!ALLOWED.has(endpoint)) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  // Append source=clarkistas to existing query params
  const sep = url.search ? "&" : "?";
  const productionUrl = `${url.origin}/api/production/${endpoint}${url.search}${sep}source=clarkistas`;

  try {
    const res = await fetch(productionUrl);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}