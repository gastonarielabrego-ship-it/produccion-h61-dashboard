import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    if (!q) return NextResponse.json({ error: "missing q" }, { status: 400 });

    const client = getClient();
    const search = "%" + q + "%";

    // Search in both tables
    const r1 = await client.execute({
      sql: "SELECT DISTINCT operario, nombre FROM production_records WHERE nombre LIKE ? ORDER BY nombre",
      args: [search],
    });
    const r2 = await client.execute({
      sql: "SELECT DISTINCT operario, nombre FROM clarkistas_records WHERE nombre LIKE ? ORDER BY nombre",
      args: [search],
    });

    const seen: Record<string, boolean> = {};
    const results: any[] = [];
    for (const r of r1.rows) {
      const key = String(r.operario);
      if (!seen[key]) { seen[key] = true; results.push({ operario: r.operario, nombre: r.nombre, tabla: "produccion" }); }
    }
    for (const r of r2.rows) {
      const key = String(r.operario);
      if (!seen[key]) { seen[key] = true; results.push({ operario: r.operario, nombre: r.nombre, tabla: "clarkistas" }); }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
