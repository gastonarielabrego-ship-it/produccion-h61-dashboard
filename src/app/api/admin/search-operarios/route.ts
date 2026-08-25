import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    if (!q) return NextResponse.json({ error: "missing q" }, { status: 400 });

    const client = getClient();
    const result = await client.execute({
      sql: "SELECT DISTINCT operario, nombre FROM production_records WHERE nombre LIKE ? ORDER BY nombre",
      args: ["%" + q + "%"],
    });
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
