import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

async function ensureTable() {
  const client = getClient();
  await client.execute({
    sql: `CREATE TABLE IF NOT EXISTS nomina_override (operario TEXT PRIMARY KEY, nombre TEXT NOT NULL DEFAULT '', fecha_alta TEXT NOT NULL DEFAULT '')`,
  });
}

// GET: list all overrides
export async function GET() {
  try {
    await ensureTable();
    const client = getClient();
    const result = await client.execute({
      sql: "SELECT * FROM nomina_override ORDER BY nombre",
    });
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: add/delete operarios from efectivo override
export async function POST(request: Request) {
  try {
    await ensureTable();
    const client = getClient();
    const body = await request.json();

    if (body.action === "delete-all") {
      await client.execute({ sql: "DELETE FROM nomina_override" });
      return NextResponse.json({ message: "Todos los overrides eliminados" });
    }

    if (body.action === "delete" && body.operario) {
      await client.execute({
        sql: "DELETE FROM nomina_override WHERE operario = ?",
        args: [body.operario],
      });
      return NextResponse.json({ message: "Override eliminado: " + body.operario });
    }

    // Insert operarios
    const operarios: { operario: string; nombre: string }[] = body.operarios || [];
    if (operarios.length === 0) {
      return NextResponse.json({ error: "no operarios provided" }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    let inserted = 0;
    for (let i = 0; i < operarios.length; i++) {
      const op = operarios[i];
      await client.execute({
        sql: "INSERT OR REPLACE INTO nomina_override (operario, nombre, fecha_alta) VALUES (?, ?, ?)",
        args: [op.operario, op.nombre, today],
      });
      inserted++;
    }

    return NextResponse.json({ inserted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
