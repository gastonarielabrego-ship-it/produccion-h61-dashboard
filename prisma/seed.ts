import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.hourlyProduction.deleteMany();
  await prisma.productionRecord.deleteMany();

  const filePath = path.join(process.cwd(), 'upload', 'h61 ver.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['Datos'];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  console.log(`Total rows to process: ${rows.length}`);

  const BATCH_SIZE = 100;
  let processed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(
      batch.map((row) => {
        const funcion = String(row['FUNCION'] ?? '');
        const funcionDesc = String(row['FUNCION_DESC'] ?? '');
        const fecha = Number(row['FECHA']) || 0;
        const turno = String(row['TURNO'] ?? '');
        const turnoDesc = String(row['TURNO_DESC'] ?? '');
        const tarea = row['TAREA'] ? String(row['TAREA']) : null;
        const operario = String(row['OPERARIO'] ?? '');
        const nombre = String(row['NOMBRE'] ?? '');
        const actividad = Number(row['ACTIVIDAD']) || 0;
        const circuito = String(row['CIRCUITO'] ?? '');
        const tiempoMue = Number(row['TIEMPO_MUE']) || 0;
        const total = Number(row['TOTAL']) || 0;

        const hourlyData: { hour: number; quantity: number }[] = [];
        for (let h = 0; h <= 23; h++) {
          const colName = `HORA_${String(h).padStart(2, '0')}`;
          const qty = Number(row[colName]) || 0;
          hourlyData.push({ hour: h, quantity: qty });
        }

        return prisma.productionRecord.create({
          data: {
            funcion,
            funcionDesc,
            date: fecha,
            turno,
            turnoDesc,
            tarea,
            operario,
            nombre,
            actividad,
            circuito,
            tiempoMue,
            total,
            hourlyData: {
              create: hourlyData,
            },
          },
        });
      })
    );

    processed += batch.length;
    if (processed % 500 === 0 || processed === rows.length) {
      console.log(`Processed ${processed}/${rows.length} records`);
    }
  }

  const count = await prisma.productionRecord.count();
  const hourlyCount = await prisma.hourlyProduction.count();
  console.log(`Done! ${count} production records, ${hourlyCount} hourly data points`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });