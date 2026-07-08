import {
  getAllRecords,
  parseFilters,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const records = await getAllRecords(filters);

    const opMap: Record<string, { operario: string; nombre: string; total: number }> = {};
    for (const r of records) {
      if (!opMap[r.operario]) {
        opMap[r.operario] = { operario: r.operario, nombre: r.nombre, total: 0 };
      }
      opMap[r.operario].total += r.total;
    }

    const operators = Object.values(opMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    return NextResponse.json({ operators });
  } catch (error) {
    console.error("Error fetching operators:", error);
    return NextResponse.json(
      { error: "Error fetching operators" },
      { status: 500 }
    );
  }
}