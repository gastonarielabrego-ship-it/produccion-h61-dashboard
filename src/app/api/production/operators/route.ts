import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const turno = searchParams.get("turno");
    const circuito = searchParams.get("circuito");

    const where: Record<string, unknown> = {};
    if (date) where.date = Number(date);
    if (turno) where.turno = turno;
    if (circuito) where.circuito = circuito;

    const operators = await db.productionRecord.groupBy({
      by: ["operario", "nombre"],
      where: Object.keys(where).length > 0 ? where : undefined,
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 20,
    });

    const data = operators.map((o) => ({
      operario: o.operario,
      nombre: o.nombre,
      total: o._sum.total || 0,
    }));

    return NextResponse.json({ operators: data });
  } catch (error) {
    console.error("Error fetching operators:", error);
    return NextResponse.json(
      { error: "Error fetching operators" },
      { status: 500 }
    );
  }
}