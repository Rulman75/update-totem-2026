import fs from 'fs';
import path from 'path';
import tls from 'tls';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { calcularDv, formatearPeriodo, formatearRut } from '../src/utils/rut';
import { procesarPlantillaPersonal, procesarPlantillaRenta } from '../src/services/csv.service';

dotenv.config({ path: path.join(__dirname, '../.env') });

// Bypass corporate proxy self-signed cert inspection for Neon PostgreSQL connection
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const origCreateSecureContext = tls.createSecureContext;
(tls as any).createSecureContext = (options: any) => {
  const ctx = origCreateSecureContext(options);
  return ctx;
};

const prisma = new PrismaClient();

const UPLOAD_DIR = 'U:\\BKP-TOTEM-WEB\\html\\totem-admin\\public\\upload';
const ORACLE_JSON_PATH = path.join(__dirname, '../data/oracle_export.json');

async function main() {
  console.log('==========================================================');
  console.log(' INICIANDO MIGRACIÓN ORACLE 12c + CSV -> POSTGRESQL (NEON)');
  console.log('==========================================================');

  if (!fs.existsSync(ORACLE_JSON_PATH)) {
    throw new Error(`No se encontró el archivo exportado de Oracle en: ${ORACLE_JSON_PATH}`);
  }

  const rawData = fs.readFileSync(ORACLE_JSON_PATH, 'utf-8');
  const oracleData = JSON.parse(rawData);

  // 1. Migrar Catálogo de Preguntas de Seguridad (TTM_PREGUNTAS_PWS)
  console.log('\n[1/6] Migrando Catálogo de Preguntas de Seguridad...');
  const preguntasOracle: any[] = oracleData.TTM_PREGUNTAS_PWS || [];
  for (const p of preguntasOracle) {
    const codigo = String(p.PRPW_COD).trim();
    const pregunta = String(p.PRPW_PREGUNTA || '').trim();
    if (!codigo || !pregunta) continue;
    await prisma.preguntaSeguridad.upsert({
      where: { codigo },
      create: { codigo, pregunta, activa: true },
      update: { pregunta, activa: true },
    });
  }
  console.log(`  ✔ ${preguntasOracle.length} preguntas de seguridad registradas.`);

  // 2. Extraer perfiles de empleados desde el último CSV de Personal disponible para enriquecer nombres, cargos y unidades
  console.log('\n[2/6] Escaneando últimos archivos CSV de Personal para enriquecer perfiles de usuarios...');
  const profileMap = new Map<
    number,
    {
      dv: string;
      nombres: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
      nombreCompleto: string;
      telefono: string;
      cargo: string;
      unidad: string;
      departamento: string;
    }
  >();

  const archivosEnriquecimiento = [
    'enero 2026 personal 2.csv',
    'marzo 2026 personal 2.csv',
    'junio 2026 personal 2.csv',
    'julio 2026 personal 2.csv',
    'agosto 2026 personal 2.csv',
    'septiembre 2026 personal 2.csv',
  ];

  for (const nombreArch of archivosEnriquecimiento) {
    const fullPath = path.join(UPLOAD_DIR, nombreArch);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath).toString('latin1');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split(';');
      if (cols.length < 60) continue;
      const rut = parseInt((cols[4] || '').trim(), 10);
      if (!rut || Number.isNaN(rut)) continue;
      const dv = (cols[5] || '').trim().toUpperCase() || calcularDv(rut);
      const apePaterno = (cols[6] || '').trim();
      const apeMaterno = (cols[7] || '').trim();
      const nombres = (cols[8] || '').trim();
      const nombreCompleto = `${nombres} ${apePaterno} ${apeMaterno}`.replace(/\s+/g, ' ').trim();
      profileMap.set(rut, {
        dv,
        nombres,
        apellidoPaterno: apePaterno,
        apellidoMaterno: apeMaterno,
        nombreCompleto,
        telefono: (cols[58] || '').trim(),
        cargo: (cols[16] || '').trim(),
        unidad: (cols[3] || '').trim(),
        departamento: (cols[1] || '').trim(),
      });
    }
  }
  console.log(`  ✔ ${profileMap.size} perfiles de funcionarios extraídos desde nóminas CSV.`);

  // Extraer correos conocidos desde TTM_ENVIO_MENSAJES
  const emailMap = new Map<number, string>();
  const mensajesOracle: any[] = oracleData.TTM_ENVIO_MENSAJES || [];
  for (const m of mensajesOracle) {
    const rut = parseInt(String(m.USUA_USUARIOS || '').replace(/\D/g, ''), 10);
    const email = String(m.ENME_EMAIL || '').trim();
    if (rut && email && email.includes('@')) {
      emailMap.set(rut, email.toLowerCase());
    }
  }

  // 3. Migrar Usuarios (Unificando TTM_USUARIOS + OAUTH_USERS)
  console.log('\n[3/6] Migrando Usuarios (TTM_USUARIOS + OAUTH_USERS)...');
  const oauthMap = new Map<number, { passwordHex: string; email: string | null }>();
  const oauthUsers: any[] = oracleData.OAUTH_USERS || [];
  for (const ou of oauthUsers) {
    const rut = parseInt(String(ou.USERNAME || '').replace(/\D/g, ''), 10);
    if (!rut || Number.isNaN(rut)) continue;
    const pwd = String(ou.PASSWORD || '').trim();
    const email = ou.EMAIL ? String(ou.EMAIL).trim() : null;
    if (pwd) {
      oauthMap.set(rut, { passwordHex: pwd, email });
    }
  }

  const ttmUsuarios: any[] = oracleData.TTM_USUARIOS || [];
  const usuariosMap = new Map<number, any>();

  for (const u of ttmUsuarios) {
    const rut = parseInt(String(u.USUA_USUARIOS || '').replace(/\D/g, ''), 10);
    if (!rut || Number.isNaN(rut)) continue;

    const oauth = oauthMap.get(rut);
    const prof = profileMap.get(rut);
    const dv = prof?.dv || calcularDv(rut);
    const rutFmt = formatearRut(rut, dv);

    const usuaClave = String(u.USUA_CLAVE || '').trim();
    let passwordHash = '';
    if (oauth && oauth.passwordHex) {
      passwordHash = `MD5:${oauth.passwordHex.toUpperCase()}`;
    } else if (usuaClave && usuaClave !== 'SINCLAVE') {
      if (/^[0-9a-fA-F]{32}$/.test(usuaClave)) {
        passwordHash = `MD5:${usuaClave.toUpperCase()}`;
      } else {
        passwordHash = `PLAIN:${usuaClave}`;
      }
    } else {
      passwordHash = `PLAIN:${String(rut).slice(-4)}`;
    }

    const esAdmin = String(u.USUA_ES_ADMIN || 'N').trim().toUpperCase() === 'S';
    const bloqueado = String(u.USUA_BLOQUEO || 'N').trim().toUpperCase() === 'S';
    const esNuevo = String(u.USUA_ES_NUEVO || 'N').trim().toUpperCase() === 'S';

    usuariosMap.set(rut, {
      rut,
      dv,
      rutFmt,
      nombres: prof?.nombres || null,
      apellidoPaterno: prof?.apellidoPaterno || null,
      apellidoMaterno: prof?.apellidoMaterno || null,
      nombreCompleto: prof?.nombreCompleto || `Funcionario RUT ${rutFmt}`,
      email: oauth?.email || emailMap.get(rut) || null,
      telefono: prof?.telefono || null,
      cargo: prof?.cargo || (esAdmin ? 'ADMINISTRADOR PORTAL TOTEM' : null),
      unidad: prof?.unidad || (esAdmin ? 'DIRECCIÓN DE RECURSOS HUMANOS' : null),
      departamento: prof?.departamento || 'CMDS',
      passwordHash,
      rol: esAdmin ? 'ADMIN' : 'FUNCIONARIO',
      bloqueado,
      esNuevo,
      fechaIngreso: u.USUA_FEC_ING ? new Date(u.USUA_FEC_ING) : new Date(),
      modificadoPor: 'MIGRACION_ORACLE',
    });
  }

  // Agregar cualquier usuario que esté en OAUTH_USERS pero no en TTM_USUARIOS
  for (const [rut, oauth] of oauthMap.entries()) {
    if (!usuariosMap.has(rut)) {
      const prof = profileMap.get(rut);
      const dv = prof?.dv || calcularDv(rut);
      const rutFmt = formatearRut(rut, dv);
      usuariosMap.set(rut, {
        rut,
        dv,
        rutFmt,
        nombres: prof?.nombres || null,
        apellidoPaterno: prof?.apellidoPaterno || null,
        apellidoMaterno: prof?.apellidoMaterno || null,
        nombreCompleto: prof?.nombreCompleto || `Funcionario RUT ${rutFmt}`,
        email: oauth.email || emailMap.get(rut) || null,
        telefono: prof?.telefono || null,
        cargo: prof?.cargo || null,
        unidad: prof?.unidad || null,
        departamento: prof?.departamento || 'CMDS',
        passwordHash: `MD5:${oauth.passwordHex.toUpperCase()}`,
        rol: 'FUNCIONARIO',
        bloqueado: false,
        esNuevo: false,
        fechaIngreso: new Date(),
        modificadoPor: 'MIGRACION_OAUTH',
      });
    }
  }

  const allUsers = Array.from(usuariosMap.values());
  await prisma.usuario.deleteMany({});
  const USER_CHUNK = 2500;
  for (let i = 0; i < allUsers.length; i += USER_CHUNK) {
    await prisma.usuario.createMany({
      data: allUsers.slice(i, i + USER_CHUNK),
      skipDuplicates: true,
    });
  }
  const totalAdmins = allUsers.filter((u) => u.rol === 'ADMIN').length;
  console.log(`  ✔ ${allUsers.length} usuarios migrados (${totalAdmins} Administradores).`);

  // 4. Migrar Respuestas de Seguridad (TTM_USUA_PREG_RESP)
  console.log('\n[4/6] Migrando Respuestas de Preguntas de Seguridad (TTM_USUA_PREG_RESP)...');
  const codigosPreguntasValidos = new Set(preguntasOracle.map((p) => String(p.PRPW_COD).trim()));
  const respuestasOracle: any[] = oracleData.TTM_USUA_PREG_RESP || [];
  const respuestasMap = new Map<string, any>();

  for (const r of respuestasOracle) {
    const rut = parseInt(String(r.USUA_USUARIOS || '').replace(/\D/g, ''), 10);
    const preguntaCodigo = String(r.PRPW_COD || '').trim();
    const orden = Number(r.USPR_ORDEN || 1);
    const respuestaHash = String(r.USPR_RESPUESTA || '').trim();

    if (!rut || !codigosPreguntasValidos.has(preguntaCodigo) || !respuestaHash) continue;
    const key = `${rut}_${orden}`;
    respuestasMap.set(key, {
      rut,
      preguntaCodigo,
      orden,
      respuestaHash,
      fechaIngreso: r.USPR_FEC_ING ? new Date(r.USPR_FEC_ING) : new Date(),
    });
  }

  const allRespuestas = Array.from(respuestasMap.values());
  await prisma.respuestaSeguridad.deleteMany({});
  const RESP_CHUNK = 4000;
  for (let i = 0; i < allRespuestas.length; i += RESP_CHUNK) {
    await prisma.respuestaSeguridad.createMany({
      data: allRespuestas.slice(i, i + RESP_CHUNK),
      skipDuplicates: true,
    });
  }
  console.log(`  ✔ ${allRespuestas.length} respuestas de seguridad migradas.`);

  // 5. Migrar Mensajes de Contacto RRHH (TTM_ENVIO_MENSAJES)
  console.log('\n[5/6] Migrando Mensajes de Contacto RRHH (TTM_ENVIO_MENSAJES)...');
  await prisma.mensajeContacto.deleteMany({});
  const mensajesData: any[] = [];

  for (const m of mensajesOracle) {
    const rut = parseInt(String(m.USUA_USUARIOS || '').replace(/\D/g, ''), 10);
    if (!rut || Number.isNaN(rut)) continue;
    const u = usuariosMap.get(rut);
    const rutFmt = u?.rutFmt || formatearRut(rut);
    const nombreUsuario = u?.nombreCompleto || `RUT ${rutFmt}`;
    const estadoRaw = String(m.ENME_ESTADO || 'NOLEIDO').trim().toUpperCase();
    const estado = estadoRaw === 'LEIDO' || estadoRaw === 'RESPONDIDO' ? 'LEIDO' : 'PENDIENTE';

    mensajesData.push({
      rut,
      rutFmt,
      nombreUsuario,
      email: String(m.ENME_EMAIL || u?.email || 'sin-correo@cmds.cl').trim(),
      mensaje: String(m.ENME_MENSAJE || '').trim(),
      estado,
      fechaEnvio: m.ENME_FEC_ENVIO ? new Date(m.ENME_FEC_ENVIO) : new Date(),
      fechaMod: m.ENME_FEC_MOD ? new Date(m.ENME_FEC_MOD) : null,
      usuarioMod: m.ENME_USER_MOD ? String(m.ENME_USER_MOD) : null,
    });
  }

  const MSG_CHUNK = 2000;
  for (let i = 0; i < mensajesData.length; i += MSG_CHUNK) {
    await prisma.mensajeContacto.createMany({
      data: mensajesData.slice(i, i + MSG_CHUNK),
    });
  }
  console.log(`  ✔ ${mensajesData.length} mensajes de contacto migrados.`);

  // 6. Migrar Historial de Procesos (TTM_PROCESOS) y Cargar Períodos Recientes 2026 desde CSV
  console.log('\n[6/6] Migrando Procesos de Carga y Nóminas CSV 2026...');
  const procesosOracle: any[] = oracleData.TTM_PROCESOS || [];
  const procAgrupados = new Map<
    number,
    {
      periodo: number;
      mes: number;
      anio: number;
      periodoFmt: string;
      nomArchPersonal: string | null;
      nomArchRenta: string | null;
      fechaCarga: Date;
      cargadoPorRut: string;
    }
  >();

  for (const pr of procesosOracle) {
    const periodo = Number(pr.PROC_PERIODO);
    if (!periodo || periodo < 201501) continue;
    const anio = Math.floor(periodo / 100);
    const mes = periodo % 100;
    const tipo = String(pr.PROC_TIPO_ARCH || '').trim().toUpperCase();
    const nomArch = String(pr.PROC_NOM_ARCH || '').trim();
    const fecha = pr.PROC_FEC_ING ? new Date(pr.PROC_FEC_ING) : new Date();

    const actual = procAgrupados.get(periodo) || {
      periodo,
      mes,
      anio,
      periodoFmt: formatearPeriodo(mes, anio),
      nomArchPersonal: null,
      nomArchRenta: null,
      fechaCarga: fecha,
      cargadoPorRut: String(pr.PROC_USER_ING || 'TOTEM_WEB_DS'),
    };

    if (tipo === 'P') actual.nomArchPersonal = nomArch;
    if (tipo === 'R') actual.nomArchRenta = nomArch;
    if (fecha > actual.fechaCarga) actual.fechaCarga = fecha;
    procAgrupados.set(periodo, actual);
  }

  for (const proc of procAgrupados.values()) {
    await prisma.procesoCarga.upsert({
      where: { periodo: proc.periodo },
      create: {
        periodo: proc.periodo,
        mes: proc.mes,
        anio: proc.anio,
        periodoFmt: proc.periodoFmt,
        nomArchPersonal: proc.nomArchPersonal,
        nomArchRenta: proc.nomArchRenta,
        estadoProceso: proc.nomArchPersonal && proc.nomArchRenta ? 'COMPLETADO' : 'PARCIAL',
        fechaCarga: proc.fechaCarga,
        cargadoPorRut: proc.cargadoPorRut,
      },
      update: {
        nomArchPersonal: proc.nomArchPersonal,
        nomArchRenta: proc.nomArchRenta,
      },
    });
  }
  console.log(`  ✔ ${procAgrupados.size} períodos históricos registrados en ProcesoCarga.`);

  // Cargar datos completos (Personal + Renta) de los últimos períodos 2026
  const periodosACargar = [202607, 202608, 202609];
  for (const per of periodosACargar) {
    const info = procAgrupados.get(per);
    if (!info) continue;

    if (info.nomArchPersonal) {
      const pPath = path.join(UPLOAD_DIR, info.nomArchPersonal);
      if (fs.existsSync(pPath)) {
        console.log(`  -> Cargando Personal ${per} (${info.nomArchPersonal})...`);
        const buf = fs.readFileSync(pPath);
        const resP = await procesarPlantillaPersonal(
          prisma,
          buf,
          info.nomArchPersonal,
          info.mes,
          info.anio,
          'MIGRACION_2026'
        );
        console.log(`     ✔ ${resP.filasInsertadas} registros de Personal insertados.`);
      }
    }

    if (info.nomArchRenta) {
      const rPath = path.join(UPLOAD_DIR, info.nomArchRenta);
      if (fs.existsSync(rPath)) {
        console.log(`  -> Cargando Renta ${per} (${info.nomArchRenta})...`);
        const buf = fs.readFileSync(rPath);
        const resR = await procesarPlantillaRenta(
          prisma,
          buf,
          info.nomArchRenta,
          info.mes,
          info.anio,
          'MIGRACION_2026'
        );
        console.log(`     ✔ ${resR.filasInsertadas} registros de Renta insertados.`);
      }
    }
  }

  console.log('\n==========================================================');
  console.log(' ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
  console.log('==========================================================');
}

main()
  .catch((e) => {
    console.error('Error en migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
