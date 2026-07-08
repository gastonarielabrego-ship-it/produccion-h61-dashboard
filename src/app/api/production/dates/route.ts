import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const dates = await db.productionRecord.findMany({
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "asc" },
    });

    const circuits = await db.productionRecord.findMany({
      select: { circuito: true },
      distinct: ["circuito"],
      orderBy: { circuito: "asc" },
    });

    const turnos = await db.productionRecord.findMany({
      select: { turno: true, turnoDesc: true },
      distinct: ["turno"],
      orderBy: { turno: "asc" },
    });

    const funciones = await db.productionRecord.findMany({
      select: { funcion: true, funcionDesc: true },
      distinct: ["funcion"],
      orderBy: { funcion: "asc" },
    });

    return NextResponse.json({
      dates: dates.map((d) => d.date),
      circuits: circuits.map((c) => c.circuito),
      shifts: turnos.map((t) => ({ value: t.turno, label: t.turnoDesc })),
      functions: funciones.map((f) => ({
        value: f.funcion,
        label: f.funcionDesc,
      })),
    });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return NextResponse.json(
      { error: "Error fetching filters" },
      { status: 500 }
    );
  }
}