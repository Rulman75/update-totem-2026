import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import tls from 'tls';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

dotenv.config({ path: path.join(__dirname, '../.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const origCreateSecureContext = tls.createSecureContext;
(tls as any).createSecureContext = (options: any) => origCreateSecureContext(options);

const prisma = new PrismaClient();

function escapeCopyValue(val: any): string {
  if (val === null || val === undefined) return '\\N';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'boolean') return val ? 't' : 'f';
  return String(val)
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

async function dumpTable(
  outStream: fs.WriteStream,
  tableName: string,
  columns: string[],
  idColumn?: string
) {
  console.log(`Exportando tabla "${tableName}"...`);
  const quotedCols = columns.map((c) => `"${c}"`).join(', ');
  outStream.write(`\n-- Data for Name: ${tableName}\n`);
  outStream.write(`COPY "${tableName}" (${quotedCols}) FROM stdin;\n`);

  const BATCH_SIZE = 15000;
  let lastId = 0;
  let offset = 0;
  let totalRows = 0;

  while (true) {
    let rows: any[];
    if (idColumn) {
      rows = await prisma.$queryRawUnsafe(
        `SELECT ${quotedCols} FROM "${tableName}" WHERE "${idColumn}" > ${lastId} ORDER BY "${idColumn}" ASC LIMIT ${BATCH_SIZE}`
      );
    } else {
      rows = await prisma.$queryRawUnsafe(
        `SELECT ${quotedCols} FROM "${tableName}" LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      );
    }

    if (!rows || rows.length === 0) break;

    const lines: string[] = [];
    for (const r of rows) {
      lines.push(columns.map((c) => escapeCopyValue(r[c])).join('\t'));
    }
    outStream.write(lines.join('\n') + '\n');

    totalRows += rows.length;
    if (idColumn) {
      lastId = Number(rows[rows.length - 1][idColumn]);
    } else {
      offset += rows.length;
    }

    if (rows.length < BATCH_SIZE) break;
  }

  outStream.write('\\.\n');
  console.log(`  ✔ ${tableName}: ${totalRows.toLocaleString('es-CL')} filas exportadas.`);
}

async function main() {
  const deployDir = path.join(__dirname, '../../deploy-produccion');
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }

  const sqlPath = path.join(deployDir, 'totem_cmds_2026.sql');
  const gzPath = path.join(deployDir, 'totem_cmds_2026.sql.gz');

  console.log('Generando esquema DDL desde Prisma...');
  const ddl = execSync(
    'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' }
  );

  const outStream = fs.createWriteStream(sqlPath, { encoding: 'utf8' });

  outStream.write(`-- ============================================================================\n`);
  outStream.write(`-- VOLCADO DE PRODUCCIÓN POSTGRESQL - PORTAL TOTEM WEB CMDS 2026\n`);
  outStream.write(`-- Fecha de generación: ${new Date().toISOString()}\n`);
  outStream.write(`-- ============================================================================\n\n`);
  outStream.write(`SET statement_timeout = 0;\n`);
  outStream.write(`SET client_encoding = 'UTF8';\n`);
  outStream.write(`SET standard_conforming_strings = on;\n\n`);

  outStream.write(`DROP TABLE IF EXISTS "AuditLog" CASCADE;\n`);
  outStream.write(`DROP TABLE IF EXISTS "MensajeContacto" CASCADE;\n`);
  outStream.write(`DROP TABLE IF EXISTS "LiquidacionRenta" CASCADE;\n`);
  outStream.write(`DROP TABLE IF EXISTS "LiquidacionPersonal" CASCADE;\n`);
  outStream.write(`DROP TABLE IF EXISTS "ProcesoCarga" CASCADE;\n`);
  outStream.write(`DROP TABLE IF EXISTS "TokenRecuperacion" CASCADE;\n`);
  outStream.write(`DROP TABLE IF EXISTS "RespuestaSeguridad" CASCADE;\n`);
  outStream.write(`DROP TABLE IF EXISTS "PreguntaSeguridad" CASCADE;\n`);
  outStream.write(`DROP TABLE IF EXISTS "Usuario" CASCADE;\n\n`);

  outStream.write(ddl + '\n');

  await dumpTable(outStream, 'PreguntaSeguridad', ['codigo', 'pregunta', 'activa']);

  await dumpTable(
    outStream,
    'Usuario',
    [
      'id',
      'rut',
      'dv',
      'rutFmt',
      'nombres',
      'apellidoPaterno',
      'apellidoMaterno',
      'nombreCompleto',
      'email',
      'telefono',
      'cargo',
      'unidad',
      'departamento',
      'passwordHash',
      'rol',
      'bloqueado',
      'esNuevo',
      'fechaIngreso',
      'updatedAt',
      'modificadoPor',
    ],
    'id'
  );

  await dumpTable(
    outStream,
    'RespuestaSeguridad',
    ['id', 'rut', 'preguntaCodigo', 'orden', 'respuestaHash', 'fechaIngreso'],
    'id'
  );

  await dumpTable(
    outStream,
    'ProcesoCarga',
    [
      'periodo',
      'mes',
      'anio',
      'periodoFmt',
      'nomArchPersonal',
      'nomArchRenta',
      'filasPersonal',
      'filasRenta',
      'estadoProceso',
      'fechaCarga',
      'cargadoPorRut',
    ],
    'periodo'
  );

  await dumpTable(
    outStream,
    'MensajeContacto',
    [
      'id',
      'rut',
      'rutFmt',
      'nombreUsuario',
      'email',
      'mensaje',
      'estado',
      'fechaEnvio',
      'fechaMod',
      'usuarioMod',
    ],
    'id'
  );

  await dumpTable(
    outStream,
    'AuditLog',
    ['id', 'accion', 'entidad', 'rutUsuario', 'nombreUsuario', 'rolUsuario', 'ip', 'userAgent', 'detalles', 'fecha'],
    'id'
  );

  await dumpTable(
    outStream,
    'LiquidacionPersonal',
    [
      'id',
      'periodo',
      'mes',
      'anio',
      'codSucursal',
      'nomSucursal',
      'codUnidad',
      'nomUnidad',
      'rut',
      'dv',
      'rutFmt',
      'apePaterno',
      'apeMaterno',
      'nombre',
      'nombreFmt',
      'sexo',
      'fecNacimiento',
      'edad',
      'detalleCont',
      'planta',
      'escala',
      'categoria',
      'descripcionCargo',
      'horas',
      'jornada',
      'bienios',
      'proxBienio',
      'grado',
      'letra',
      'inicioContrato',
      'terminoContrato',
      'antiguedad',
      'vigencia',
      'totNormal',
      'totInvalida',
      'totMaternal',
      'nroCargas',
      'codAfp',
      'nomAfp',
      'porcAfp',
      'porcAdicional',
      'inva',
      'adminAfp',
      'rebaja',
      'codSalud',
      'nomSalud',
      'porcFijoSalud',
      'montoFijoSalud',
      'montoPesoSalud',
      'porcAportePat',
      'mtoAportePat',
      'totHaberes',
      'totDesctos',
      'sdoImponib',
      'montoImponi',
      'mtoCotiza',
      'mtoAdic',
      'mtoSalud',
      'tributa',
      'liquidoPago',
      'diasTrab',
      'mtoPorcen',
      'cesEmpleado',
      'cesEmpleador',
      'invEmpleador',
      'direccion',
      'telefono',
      'nacionalidad',
      'estadoCivil',
      'formaPago',
      'nroCuenta',
      'razonSocialBanco',
      'escolaridad',
      'codTitulo',
      'descTitulo',
      'codEspec',
      'descEspec',
    ],
    'id'
  );

  await dumpTable(
    outStream,
    'LiquidacionRenta',
    [
      'id',
      'periodo',
      'codUnidad',
      'rut',
      'dv',
      'paterno',
      'materno',
      'nombre',
      'codHaber',
      'nomHaber',
      'montoHaber',
      'codDescuento',
      'nomDescuento',
      'montoDescuento',
      'mes',
      'anio',
    ],
    'id'
  );

  outStream.write(`\n-- Actualizar secuencias autoincrementales\n`);
  outStream.write(`SELECT setval(pg_get_serial_sequence('"Usuario"', 'id'), COALESCE((SELECT MAX("id") FROM "Usuario"), 1));\n`);
  outStream.write(`SELECT setval(pg_get_serial_sequence('"RespuestaSeguridad"', 'id'), COALESCE((SELECT MAX("id") FROM "RespuestaSeguridad"), 1));\n`);
  outStream.write(`SELECT setval(pg_get_serial_sequence('"MensajeContacto"', 'id'), COALESCE((SELECT MAX("id") FROM "MensajeContacto"), 1));\n`);
  outStream.write(`SELECT setval(pg_get_serial_sequence('"AuditLog"', 'id'), COALESCE((SELECT MAX("id") FROM "AuditLog"), 1));\n`);
  outStream.write(`SELECT setval(pg_get_serial_sequence('"LiquidacionPersonal"', 'id'), COALESCE((SELECT MAX("id") FROM "LiquidacionPersonal"), 1));\n`);
  outStream.write(`SELECT setval(pg_get_serial_sequence('"LiquidacionRenta"', 'id'), COALESCE((SELECT MAX("id") FROM "LiquidacionRenta"), 1));\n`);
  outStream.write(`ANALYZE;\n`);

  await new Promise<void>((resolve) => outStream.end(resolve));

  console.log('Comprimiendo volcado a .sql.gz...');
  await new Promise<void>((resolve, reject) => {
    const inp = fs.createReadStream(sqlPath);
    const out = fs.createWriteStream(gzPath);
    const gzip = zlib.createGzip({ level: 6 });
    inp.pipe(gzip).pipe(out).on('finish', resolve).on('error', reject);
  });

  const sqlStat = fs.statSync(sqlPath);
  const gzStat = fs.statSync(gzPath);

  console.log('==============================================================');
  console.log(' ¡VOLCADO POSTGRESQL GENERADO EXITOSAMENTE!');
  console.log(` - SQL plano : ${sqlPath} (${(sqlStat.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(` - SQL.GZ    : ${gzPath} (${(gzStat.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log('==============================================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
