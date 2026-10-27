import fs from 'fs';
import path from 'path';
import tls from 'tls';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { procesarPlantillaPersonal } from '../src/services/csv.service';

dotenv.config({ path: path.join(__dirname, '../.env') });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const origCreateSecureContext = tls.createSecureContext;
(tls as any).createSecureContext = (options: any) => origCreateSecureContext(options);

const prisma = new PrismaClient();
const UPLOAD_DIR = 'U:\\BKP-TOTEM-WEB\\html\\totem-admin\\public\\upload';

async function main() {
  console.log('==============================================================');
  console.log(' CARGANDO VENTANA HISTÓRICA DE 5 AÑOS MÓVILES (2022 - 2026)');
  console.log('==============================================================');

  const procesos = await prisma.procesoCarga.findMany({
    where: {
      anio: { gte: 2022 },
    },
    orderBy: { periodo: 'desc' },
  });

  for (const proc of procesos) {
    if (proc.filasPersonal > 0) {
      console.log(`  [SKIP] Período ${proc.periodo} (${proc.periodoFmt}) ya cargado (${proc.filasPersonal} fichas).`);
      continue;
    }

    if (!proc.nomArchPersonal) continue;
    const filePath = path.join(UPLOAD_DIR, proc.nomArchPersonal);
    if (!fs.existsSync(filePath)) {
      console.log(`  [WARN] Archivo no encontrado: ${filePath}`);
      continue;
    }

    const buf = fs.readFileSync(filePath);
    let success = false;
    for (let attempt = 1; attempt <= 3 && !success; attempt++) {
      try {
        const res = await procesarPlantillaPersonal(
          prisma,
          buf,
          proc.nomArchPersonal,
          proc.mes,
          proc.anio,
          'MIGRACION_5_ANIOS'
        );
        console.log(
          `  ✔ [${proc.periodo}] ${proc.periodoFmt}: ${res.filasInsertadas} liquidaciones cargadas (${res.nuevosUsuarios} usuarios nuevos).`
        );
        success = true;
      } catch (err: any) {
        console.warn(`  [RETRY ${attempt}/3] Error en período ${proc.periodo}: ${err.message || err}`);
        await prisma.$disconnect().catch(() => {});
        await new Promise((r) => setTimeout(r, 2000));
        await prisma.$connect().catch(() => {});
      }
    }
  }

  console.log('==============================================================');
  console.log(' ¡HISTORIAL DE 5 AÑOS MÓVILES (2022-2026) COMPLETADO!');
  console.log('==============================================================');
}

main()
  .catch((e) => {
    console.error('Error en carga de 5 años:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
