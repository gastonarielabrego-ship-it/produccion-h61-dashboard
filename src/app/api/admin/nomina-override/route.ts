import { getClient } from "@/lib/neon";
import { NextResponse } from "next/server";

// Table pre-created via Neon migration

// GET: list all overrides
export async function GET() {
  try {
    const client = getClient();
    const result = await client.execute("SELECT * FROM nomina_override ORDER BY nombre");
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: add/delete operarios from efectivo override
export async function POST(request: Request) {
  try {
    const client = getClient();
    const body = await request.json();

    if (body.action === "delete-all") {
      await client.execute("DELETE FROM nomina_override");
      return NextResponse.json({ message: "Todos los overrides eliminados" });
    }

    if (body.action === "delete" && body.operario) {
      await client.execute("DELETE FROM nomina_override WHERE operario = $1", [body.operario]);
      return NextResponse.json({ message: "Override eliminado: " + body.operario });
    }

    // Insert operarios (PostgreSQL: ON CONFLICT for upsert)
    const operarios: { operario: string; nombre: string }[] = body.operarios || [];
    if (operarios.length === 0) {
      return NextResponse.json({ error: "no operarios provided" }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    let inserted = 0;
    for (let i = 0; i < operarios.length; i++) {
      const op = operarios[i];
      await client.execute(
        "INSERT INTO nomina_override (operario, nombre, fecha_alta) VALUES ($1, $2, $3) ON CONFLICT (operario) DO UPDATE SET nombre = EXCLUDED.nombre, fecha_alta = EXCLUDED.fecha_alta",
        [op.operario, op.nombre, today],
      );
      inserted++;
    }

    return NextResponse.json({ inserted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
