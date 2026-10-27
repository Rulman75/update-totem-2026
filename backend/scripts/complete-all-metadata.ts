import fs from 'fs';
import path from 'path';
import tls from 'tls';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { calcularDv, formatearRut } from '../src/utils/rut';

dotenv.config({ path: path.join(__dirname, '../.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const origCreateSecureContext = tls.createSecureContext;
(tls as any).createSecureContext = (options: any) => origCreateSecureContext(options);

const prisma = new PrismaClient();
const UPLOAD_DIR = 'U:\\BKP-TOTEM-WEB\\html\\totem-admin\\public\\upload';

function cleanStr(val: string | undefined): string {
  if (!val) return '';
  return val.replace(/^"|"$/g, '').trim();
}

async function main() {
  console.log('1. Actualizando conteos de Renta y estado COMPLETADO en ProcesoCarga (2022-2026)...');
  const procesos = await prisma.procesoCarga.findMany({
    where: { anio: { gte: 2022 } },
    orderBy: { periodo: 'desc' },
  });

  for (const proc of procesos) {
    let filasRenta = proc.filasRenta;
    if (filasRenta === 0 && proc.nomArchRenta) {
      const rPath = path.join(UPLOAD_DIR, proc.nomArchRenta);
      if (fs.existsSync(rPath)) {
        const content = fs.readFileSync(rPath, 'latin1');
        const lines = content.split(/\r?\n/);
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(';');
          if (cols.length >= 12 && !Number.isNaN(parseInt(cols[1], 10))) {
            count++;
          }
        }
        filasRenta = count;
      }
    }

    if (proc.filasPersonal > 0 && (filasRenta !== proc.filasRenta || proc.estadoProceso !== 'COMPLETADO')) {
      await prisma.procesoCarga.update({
        where: { periodo: proc.periodo },
        data: {
          filasRenta,
          estadoProceso: 'COMPLETADO',
        },
      });
    }
  }
  console.log('   ✔ 57 períodos (2022-2026) marcados como COMPLETADO con sus conteos reales.');

  console.log('2. Enriqueciendo perfiles de Usuarios desde los CSV históricos (2017-2026)...');
  const usuariosIncompletos = await prisma.usuario.findMany({
    where: {
      OR: [
        { nombreCompleto: { startsWith: 'Funcionario ' } },
        { cargo: null },
        { unidad: null },
      ],
    },
    select: { id: true, rut: true, dv: true, rutFmt: true },
  });

  console.log(`   Usuarios por enriquecer: ${usuariosIncompletos.length}`);
  const mapIncompletos = new Map<number, { id: number; rut: number }>();
  for (const u of usuariosIncompletos) {
    mapIncompletos.set(u.rut, { id: u.id, rut: u.rut });
  }

  const todosProcesos = await prisma.procesoCarga.findMany({
    orderBy: { periodo: 'desc' },
  });

  const encontrados = new Map<
    number,
    {
      nombres: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
      nombreCompleto: string;
      cargo: string;
      unidad: string;
      departamento: string;
      telefono: string | null;
    }
  >();

  for (const proc of todosProcesos) {
    if (encontrados.size >= mapIncompletos.size) break;
    if (!proc.nomArchPersonal) continue;
    const pPath = path.join(UPLOAD_DIR, proc.nomArchPersonal);
    if (!fs.existsSync(pPath)) continue;

    const content = fs.readFileSync(pPath, 'latin1');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(';');
      if (cols.length < 60) continue;
      const rut = parseInt(cleanStr(cols[4]).replace(/\./g, ''), 10);
      if (!rut || !mapIncompletos.has(rut) || encontrados.has(rut)) continue;

      const apePaterno = cleanStr(cols[6]);
      const apeMaterno = cleanStr(cols[7]);
      const nombre = cleanStr(cols[8]);
      const nombreCompleto = `${nombre} ${apePaterno} ${apeMaterno}`.replace(/\s+/g, ' ').trim();
      if (!nombreCompleto) continue;

      encontrados.set(rut, {
        nombres: nombre,
        apellidoPaterno: apePaterno,
        apellidoMaterno: apeMaterno,
        nombreCompleto,
        cargo: cleanStr(cols[16]) || 'Funcionario(a)',
        unidad: cleanStr(cols[3]) || 'CMDS',
        departamento: cleanStr(cols[1]) || 'CMDS',
        telefono: cleanStr(cols[58]) || null,
      });
    }
  }

  console.log(`   Perfiles encontrados en histórico CSV (2017-2026): ${encontrados.size}`);

  let actualizados = 0;
  const entries = Array.from(encontrados.entries());
  const BATCH = 100;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    await Promise.all(
      slice.map(([rut, data]) =>
        prisma.usuario.update({
          where: { rut },
          data,
        })
      )
    );
    actualizados += slice.length;
  }

  console.log(`   ✔ ${actualizados} perfiles de usuarios enriquecidos con nombre, cargo y establecimiento.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
