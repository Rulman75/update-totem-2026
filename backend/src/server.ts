import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import {
  calcularDv,
  extraerCandidatosRut,
  formatearPeriodo,
  formatearRut,
  hashearPassword,
  hashearRespuestaSeguridad,
  verificarPassword,
  verificarRespuestaSeguridad,
} from './utils/rut';
import { procesarPlantillaPersonal, procesarPlantillaRenta } from './services/csv.service';
import { generarPdfCertificadoAntiguedad, generarPdfLiquidacion } from './services/pdf.service';

dotenv.config();

// Bypass corporate proxy TLS inspection for Neon PostgreSQL pooler
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const origCreateSecureContext = tls.createSecureContext;
(tls as any).createSecureContext = (options: any) => {
  return origCreateSecureContext(options);
};

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'totem_cmds_2026_super_secret_jwt_key';
const LEGACY_UPLOAD_DIR =
  process.env.UPLOAD_DIR || 'U:\\BKP-TOTEM-WEB\\html\\totem-admin\\public\\upload';

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Exponer logos institucionales para cabeceras si el frontend los requiere
app.use('/assets', express.static(path.join(__dirname, '../assets')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max para archivos Renta CSV
});

interface AuthUserPayload {
  id: number;
  rut: number;
  dv: string;
  rutFmt: string;
  nombreCompleto: string;
  rol: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

async function registrarAuditoria(
  req: Request,
  accion: string,
  entidad: string,
  detalles: Record<string, any>,
  overrideUser?: { rutFmt: string; nombreCompleto?: string | null; rol: string }
) {
  try {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Desconocido';

    const rutUsuario = overrideUser?.rutFmt || req.user?.rutFmt || 'ANÓNIMO';
    const nombreUsuario = overrideUser?.nombreCompleto || req.user?.nombreCompleto || null;
    const rolUsuario = overrideUser?.rol || req.user?.rol || 'PUBLICO';

    await prisma.auditLog.create({
      data: {
        accion,
        entidad,
        rutUsuario,
        nombreUsuario,
        rolUsuario,
        ip,
        userAgent,
        detalles: JSON.stringify(detalles),
      },
    });
  } catch (err) {
    console.error('Error registrando auditoría:', err);
  }
}

function autenticarJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const tokenQuery = req.query.token as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : tokenQuery;

  if (!token) {
    res.status(401).json({ error: 'No autenticado. Token requerido.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Sesión expirada o inválida. Por favor inicie sesión nuevamente.' });
  }
}

function requerirAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.rol !== 'ADMIN') {
    res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de Administrador.' });
    return;
  }
  next();
}

function mascararEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 2, 5))}@${domain}`;
}

async function buscarUsuarioPorRutInput(input: string) {
  const candidatos = extraerCandidatosRut(input);
  for (const rut of candidatos) {
    const usuario = await prisma.usuario.findUnique({ where: { rut } });
    if (usuario) return usuario;
  }
  return null;
}

/**
 * Obtiene el desglose de Haberes y Descuentos (LiquidacionRenta) desde PostgreSQL.
 * Si el período histórico aún no tiene cargadas las líneas de Renta en PostgreSQL,
 * extrae al vuelo las filas del funcionario desde el archivo CSV de respaldo y las guarda en caché en PostgreSQL.
 */
async function obtenerRentasFuncionario(personal: {
  periodo: number;
  rut: number;
  codUnidad: number;
  mes: number;
  anio: number;
}) {
  let rentas = await prisma.liquidacionRenta.findMany({
    where: {
      periodo: personal.periodo,
      rut: personal.rut,
      codUnidad: personal.codUnidad,
    },
  });

  if (rentas.length === 0) {
    rentas = await prisma.liquidacionRenta.findMany({
      where: {
        periodo: personal.periodo,
        rut: personal.rut,
      },
    });
  }

  if (rentas.length > 0) {
    return rentas;
  }

  // Fallback instantáneo desde el respaldo CSV si existe el archivo de Renta del período
  try {
    const proc = await prisma.procesoCarga.findUnique({
      where: { periodo: personal.periodo },
    });
    if (proc?.nomArchRenta) {
      const rPath = path.join(LEGACY_UPLOAD_DIR, proc.nomArchRenta);
      if (fs.existsSync(rPath)) {
        const content = fs.readFileSync(rPath, 'latin1');
        const lines = content.split(/\r?\n/);
        const targetRutStr = String(personal.rut);
        const rowsForUser: any[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(';');
          if (cols.length < 12) continue;
          if ((cols[1] || '').trim() !== targetRutStr) continue;

          const clean = (v?: string) => (v ? v.replace(/^"|"$/g, '').trim() : '');
          const toInt = (v?: string) => {
            const n = parseInt(clean(v).replace(/\./g, ''), 10);
            return Number.isNaN(n) ? 0 : n;
          };

          rowsForUser.push({
            periodo: personal.periodo,
            codUnidad: toInt(cols[0]),
            rut: personal.rut,
            dv: clean(cols[2]).toUpperCase() || calcularDv(personal.rut),
            paterno: clean(cols[3]) || null,
            materno: clean(cols[4]) || null,
            nombre: clean(cols[5]) || null,
            codHaber: toInt(cols[6]),
            nomHaber: clean(cols[7]) || null,
            montoHaber: toInt(cols[8]),
            codDescuento: toInt(cols[9]),
            nomDescuento: clean(cols[10]) || null,
            montoDescuento: toInt(cols[11]),
            mes: toInt(cols[12]) || personal.mes,
            anio: toInt(cols[13]) || personal.anio,
          });
        }

        if (rowsForUser.length > 0) {
          await prisma.liquidacionRenta.createMany({ data: rowsForUser });
          const filtradasUnidad = rowsForUser.filter((r) => r.codUnidad === personal.codUnidad);
          return filtradasUnidad.length > 0 ? filtradasUnidad : rowsForUser;
        }
      }
    }
  } catch (err) {
    console.error('Error en fallback CSV de Renta:', err);
  }

  return [];
}

// ============================================================================
// 1. ENDPOINTS DE AUTENTICACIÓN Y RECUPERACIÓN DE CLAVE
// ============================================================================

app.get('/api/health', async (_req: Request, res: Response) => {
  const totalUsuarios = await prisma.usuario.count();
  res.json({
    status: 'OK',
    servicio: 'Portal Web Totem CMDS 2026',
    database: 'PostgreSQL (Prisma)',
    totalUsuarios,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/auth/preguntas-catalogo', async (_req: Request, res: Response) => {
  try {
    const preguntas = await prisma.preguntaSeguridad.findMany({
      where: { activa: true },
      orderBy: { codigo: 'asc' },
    });
    res.json(preguntas);
  } catch (err: any) {
    res.status(500).json({ error: 'Error obteniendo catálogo de preguntas.', detalle: err.message });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { rut, password } = req.body;
    if (!rut || !password) {
      res.status(400).json({ error: 'Debe ingresar su RUT y contraseña.' });
      return;
    }

    const candidatos = extraerCandidatosRut(String(rut));
    console.log(`[AUTH] Login intento -> input="${rut}", candidatos=${JSON.stringify(candidatos)}`);

    const usuario = await buscarUsuarioPorRutInput(String(rut));
    if (!usuario) {
      console.log(`[AUTH] Usuario no encontrado para input="${rut}"`);
      res.status(401).json({ error: 'RUT o contraseña incorrectos.' });
      return;
    }

    if (usuario.bloqueado) {
      res.status(403).json({
        error: 'Su cuenta se encuentra bloqueada. Por favor contacte al Departamento de Recursos Humanos.',
      });
      return;
    }

    let { valid, needsUpgrade } = await verificarPassword(String(password), usuario.passwordHash);

    // Soporte para funcionarios recién incorporados cuya clave inicial son los últimos 4 dígitos del RUT sin DV
    if (!valid && usuario.esNuevo) {
      const ultimos4 = String(usuario.rut).slice(-4);
      if (String(password).trim() === ultimos4) {
        valid = true;
        needsUpgrade = true;
      }
    }

    if (!valid) {
      res.status(401).json({ error: 'RUT o contraseña incorrectos.' });
      return;
    }

    // Si el hash era MD5 o PLAIN legado y el usuario no está obligado a cambiar clave inmediatamente, actualizar a bcrypt
    if (needsUpgrade && !usuario.esNuevo) {
      const nuevoHash = await hashearPassword(String(password));
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { passwordHash: nuevoHash },
      });
    }

    const countRespuestas = await prisma.respuestaSeguridad.count({
      where: { rut: usuario.rut },
    });

    const payload: AuthUserPayload = {
      id: usuario.id,
      rut: usuario.rut,
      dv: usuario.dv,
      rutFmt: usuario.rutFmt,
      nombreCompleto: usuario.nombreCompleto || `Funcionario ${usuario.rutFmt}`,
      rol: usuario.rol,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '10h' });

    await registrarAuditoria(
      req,
      'LOGIN',
      'Auth',
      { rut: usuario.rut, rol: usuario.rol, esNuevo: usuario.esNuevo },
      {
        rutFmt: usuario.rutFmt,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
      }
    );

    res.json({
      token,
      user: {
        id: usuario.id,
        rut: usuario.rut,
        dv: usuario.dv,
        rutFmt: usuario.rutFmt,
        nombres: usuario.nombres,
        apellidoPaterno: usuario.apellidoPaterno,
        apellidoMaterno: usuario.apellidoMaterno,
        nombreCompleto: usuario.nombreCompleto || `Funcionario ${usuario.rutFmt}`,
        email: usuario.email,
        telefono: usuario.telefono,
        cargo: usuario.cargo,
        unidad: usuario.unidad,
        departamento: usuario.departamento,
        rol: usuario.rol,
        esNuevo: usuario.esNuevo,
        tienePreguntasSeguridad: countRespuestas >= 3,
      },
    });
  } catch (err: any) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno al iniciar sesión.', detalle: err.message });
  }
});

app.get('/api/auth/me', autenticarJWT, async (req: Request, res: Response) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { rut: req.user!.rut },
    });
    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const respuestas = await prisma.respuestaSeguridad.findMany({
      where: { rut: usuario.rut },
      include: { pregunta: true },
      orderBy: { orden: 'asc' },
    });

    res.json({
      id: usuario.id,
      rut: usuario.rut,
      dv: usuario.dv,
      rutFmt: usuario.rutFmt,
      nombres: usuario.nombres,
      apellidoPaterno: usuario.apellidoPaterno,
      apellidoMaterno: usuario.apellidoMaterno,
      nombreCompleto: usuario.nombreCompleto,
      email: usuario.email,
      telefono: usuario.telefono,
      cargo: usuario.cargo,
      unidad: usuario.unidad,
      departamento: usuario.departamento,
      rol: usuario.rol,
      esNuevo: usuario.esNuevo,
      tienePreguntasSeguridad: respuestas.length >= 3,
      preguntasConfiguradas: respuestas.map((r) => ({
        orden: r.orden,
        codigo: r.preguntaCodigo,
        pregunta: r.pregunta.pregunta,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error obteniendo perfil de sesión.', detalle: err.message });
  }
});

// Paso 1 Recuperación de Clave: Validar RUT y consultar preguntas de seguridad o correo registrado
app.post('/api/auth/validar-rut', async (req: Request, res: Response) => {
  try {
    const { rut } = req.body;
    if (!rut) {
      res.status(400).json({ error: 'Debe ingresar su RUT.' });
      return;
    }

    const usuario = await buscarUsuarioPorRutInput(String(rut));
    if (!usuario) {
      res.status(404).json({ error: 'No se encontró un funcionario registrado con el RUT indicado.' });
      return;
    }

    const respuestas = await prisma.respuestaSeguridad.findMany({
      where: { rut: usuario.rut },
      include: { pregunta: true },
      orderBy: { orden: 'asc' },
    });

    res.json({
      rut: usuario.rut,
      rutFmt: usuario.rutFmt,
      nombreCompleto: usuario.nombreCompleto,
      tienePreguntas: respuestas.length >= 3,
      preguntas: respuestas.map((r) => ({
        orden: r.orden,
        codigo: r.preguntaCodigo,
        pregunta: r.pregunta.pregunta,
      })),
      tieneEmail: Boolean(usuario.email && usuario.email.includes('@')),
      emailMascarado: mascararEmail(usuario.email),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error validando RUT.', detalle: err.message });
  }
});

// Paso 2 Recuperación de Clave por Preguntas de Seguridad
app.post('/api/auth/responder-preguntas', async (req: Request, res: Response) => {
  try {
    const { rut, respuestas, nuevaPassword } = req.body;
    if (!rut || !Array.isArray(respuestas) || !nuevaPassword) {
      res.status(400).json({ error: 'Datos incompletos para recuperar contraseña.' });
      return;
    }

    if (String(nuevaPassword).trim().length < 4) {
      res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
      return;
    }

    const usuario = await buscarUsuarioPorRutInput(String(rut));
    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const guardadas = await prisma.respuestaSeguridad.findMany({
      where: { rut: usuario.rut },
      orderBy: { orden: 'asc' },
    });

    if (guardadas.length === 0) {
      res.status(400).json({
        error: 'Su cuenta no tiene preguntas de seguridad configuradas. Solicite restablecimiento a RRHH.',
      });
      return;
    }

    let correctas = 0;
    for (const g of guardadas) {
      const enviada = respuestas.find((r: any) => Number(r.orden) === g.orden);
      if (enviada && enviada.respuesta) {
        const ok = await verificarRespuestaSeguridad(String(enviada.respuesta), g.respuestaHash);
        if (ok) correctas++;
      }
    }

    // Exigimos que las 3 respuestas coincidan (o el total de preguntas que tenga registradas)
    if (correctas < guardadas.length) {
      res.status(401).json({
        error: 'Una o más respuestas de seguridad no coinciden con las registradas.',
      });
      return;
    }

    const passwordHash = await hashearPassword(String(nuevaPassword).trim());
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash,
        esNuevo: false,
        bloqueado: false,
        modificadoPor: 'RECUPERACION_PREGUNTAS',
      },
    });

    await registrarAuditoria(
      req,
      'RECUPERACION_CLAVE',
      'Auth',
      { metodo: 'PREGUNTAS_SEGURIDAD', rut: usuario.rut },
      { rutFmt: usuario.rutFmt, nombreCompleto: usuario.nombreCompleto, rol: usuario.rol }
    );

    res.json({
      mensaje: 'Su contraseña ha sido actualizada exitosamente. Ya puede iniciar sesión.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error procesando respuestas de seguridad.', detalle: err.message });
  }
});

// Cambio de Clave y/o Configuración de Preguntas de Seguridad (Onboarding o Perfil)
app.post('/api/auth/cambiar-clave', autenticarJWT, async (req: Request, res: Response) => {
  try {
    const { passwordActual, nuevaPassword, email, respuestas } = req.body;
    const usuario = await prisma.usuario.findUnique({ where: { rut: req.user!.rut } });

    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    // Si no es usuario nuevo, verificamos su contraseña actual si fue enviada
    if (!usuario.esNuevo && passwordActual) {
      const { valid } = await verificarPassword(String(passwordActual), usuario.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'La contraseña actual ingresada no es correcta.' });
        return;
      }
    }

    if (!nuevaPassword || String(nuevaPassword).trim().length < 4) {
      res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
      return;
    }

    const passwordHash = await hashearPassword(String(nuevaPassword).trim());

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash,
        esNuevo: false,
        email: email ? String(email).trim().toLowerCase() : usuario.email,
        modificadoPor: usuario.rutFmt,
      },
    });

    // Si incluye configuración de las 3 preguntas de seguridad
    if (Array.isArray(respuestas) && respuestas.length === 3) {
      for (const item of respuestas) {
        const orden = Number(item.orden);
        const preguntaCodigo = String(item.codigo).trim();
        const textoResp = String(item.respuesta || '').trim();
        if (!orden || !preguntaCodigo || !textoResp) continue;

        const respuestaHash = await hashearRespuestaSeguridad(textoResp);
        await prisma.respuestaSeguridad.upsert({
          where: {
            rut_orden: {
              rut: usuario.rut,
              orden,
            },
          },
          create: {
            rut: usuario.rut,
            preguntaCodigo,
            orden,
            respuestaHash,
          },
          update: {
            preguntaCodigo,
            respuestaHash,
            fechaIngreso: new Date(),
          },
        });
      }
    }

    await registrarAuditoria(req, 'CAMBIO_CLAVE', 'Auth', {
      actualizoPreguntas: Array.isArray(respuestas) && respuestas.length === 3,
    });

    res.json({
      mensaje: 'Contraseña y configuración de seguridad actualizadas correctamente.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al cambiar la contraseña.', detalle: err.message });
  }
});

app.post('/api/auth/guardar-preguntas', autenticarJWT, async (req: Request, res: Response) => {
  try {
    const { respuestas, email } = req.body;
    const rut = req.user!.rut;

    if (!Array.isArray(respuestas) || respuestas.length !== 3) {
      res.status(400).json({ error: 'Debe seleccionar y responder las 3 preguntas de seguridad.' });
      return;
    }

    const codigos = new Set(respuestas.map((r: any) => String(r.codigo)));
    if (codigos.size < 3) {
      res.status(400).json({ error: 'Debe elegir 3 preguntas de seguridad distintas.' });
      return;
    }

    for (let i = 0; i < 3; i++) {
      const r = respuestas[i];
      const orden = i + 1;
      const preguntaCodigo = String(r.codigo).trim();
      const texto = String(r.respuesta || '').trim();
      if (!texto) {
        res.status(400).json({ error: `La respuesta #${orden} no puede estar vacía.` });
        return;
      }
      const respuestaHash = await hashearRespuestaSeguridad(texto);

      await prisma.respuestaSeguridad.upsert({
        where: { rut_orden: { rut, orden } },
        create: { rut, preguntaCodigo, orden, respuestaHash },
        update: { preguntaCodigo, respuestaHash, fechaIngreso: new Date() },
      });
    }

    if (email && String(email).includes('@')) {
      await prisma.usuario.update({
        where: { rut },
        data: { email: String(email).trim().toLowerCase() },
      });
    }

    await registrarAuditoria(req, 'CONFIGURAR_PREGUNTAS', 'Auth', { rut });
    res.json({ mensaje: 'Preguntas de seguridad guardadas correctamente.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Error guardando preguntas de seguridad.', detalle: err.message });
  }
});

// ============================================================================
// 2. ENDPOINTS DEL PORTAL DEL FUNCIONARIO (LIQUIDACIONES, CERTIFICADOS, PERFIL)
// ============================================================================

app.get('/api/liquidaciones', autenticarJWT, async (req: Request, res: Response) => {
  try {
    // Permite que un ADMIN consulte por query ?rut=12345678, o el propio funcionario
    const targetRut =
      req.user!.rol === 'ADMIN' && req.query.rut
        ? Number(req.query.rut)
        : req.user!.rut;

    // Ventana histórica de 5 años móviles (ej: 2022 a 2026)
    const anioActual = new Date().getFullYear();
    const anioMinimo = anioActual - 4;

    const liquidaciones = await prisma.liquidacionPersonal.findMany({
      where: {
        rut: targetRut,
        anio: { gte: anioMinimo },
      },
      orderBy: [{ periodo: 'desc' }, { codUnidad: 'asc' }],
      select: {
        id: true,
        periodo: true,
        mes: true,
        anio: true,
        codSucursal: true,
        nomSucursal: true,
        codUnidad: true,
        nomUnidad: true,
        rut: true,
        dv: true,
        rutFmt: true,
        nombreFmt: true,
        descripcionCargo: true,
        detalleCont: true,
        horas: true,
        jornada: true,
        diasTrab: true,
        totHaberes: true,
        totDesctos: true,
        liquidoPago: true,
        montoImponi: true,
        tributa: true,
        formaPago: true,
        nomAfp: true,
        nomSalud: true,
      },
    });

    const enriquecidas = liquidaciones.map((l) => ({
      ...l,
      periodoFmt: formatearPeriodo(l.mes, l.anio),
    }));

    res.json(enriquecidas);
  } catch (err: any) {
    res.status(500).json({ error: 'Error obteniendo liquidaciones.', detalle: err.message });
  }
});

app.get('/api/liquidaciones/:id/detalle', autenticarJWT, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const personal = await prisma.liquidacionPersonal.findUnique({ where: { id } });

    if (!personal) {
      res.status(404).json({ error: 'Liquidación no encontrada.' });
      return;
    }

    if (req.user!.rol !== 'ADMIN' && personal.rut !== req.user!.rut) {
      res.status(403).json({ error: 'No tiene permiso para consultar esta liquidación.' });
      return;
    }

    const rentas = await obtenerRentasFuncionario(personal);

    const haberes = rentas
      .filter((r) => (r.codHaber && r.codHaber > 0) || (r.montoHaber && r.montoHaber > 0))
      .sort((a, b) => a.codHaber - b.codHaber)
      .map((r) => ({
        codigo: r.codHaber,
        concepto: r.nomHaber,
        monto: r.montoHaber,
      }));

    const descuentos = rentas
      .filter((r) => (r.codDescuento && r.codDescuento > 0) || (r.montoDescuento && r.montoDescuento > 0))
      .sort((a, b) => a.codDescuento - b.codDescuento)
      .map((r) => ({
        codigo: r.codDescuento,
        concepto: r.nomDescuento,
        monto: r.montoDescuento,
      }));

    res.json({
      personal: {
        ...personal,
        periodoFmt: formatearPeriodo(personal.mes, personal.anio),
      },
      haberes,
      descuentos,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error obteniendo detalle de liquidación.', detalle: err.message });
  }
});

app.get('/api/liquidaciones/:id/pdf', autenticarJWT, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const personal = await prisma.liquidacionPersonal.findUnique({ where: { id } });

    if (!personal) {
      res.status(404).json({ error: 'Liquidación no encontrada.' });
      return;
    }

    if (req.user!.rol !== 'ADMIN' && personal.rut !== req.user!.rut) {
      res.status(403).json({ error: 'No tiene permiso para descargar esta liquidación.' });
      return;
    }

    const rentas = await obtenerRentasFuncionario(personal);

    const pdfBuffer = await generarPdfLiquidacion(personal, rentas as any);

    await registrarAuditoria(req, 'DESCARGA_LIQUIDACION', 'Liquidacion', {
      periodo: personal.periodo,
      rut: personal.rut,
      unidad: personal.nomUnidad,
    });

    const filename = `liquidacion${personal.rut}_${personal.periodo}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('Error generando PDF liquidación:', err);
    res.status(500).json({ error: 'Error generando PDF de liquidación.', detalle: err.message });
  }
});

app.get('/api/certificados/antiguedad/info', autenticarJWT, async (req: Request, res: Response) => {
  try {
    const targetRut =
      req.user!.rol === 'ADMIN' && req.query.rut
        ? Number(req.query.rut)
        : req.user!.rut;

    const ultimoRegistro = await prisma.liquidacionPersonal.findFirst({
      where: { rut: targetRut },
      orderBy: { periodo: 'desc' },
    });

    if (!ultimoRegistro) {
      res.status(404).json({ error: 'No se encontraron registros contractuales vigentes para este RUT.' });
      return;
    }

    const contratos = await prisma.liquidacionPersonal.findMany({
      where: { rut: targetRut, periodo: ultimoRegistro.periodo },
      orderBy: { codUnidad: 'asc' },
    });

    res.json({
      periodoReferencia: formatearPeriodo(ultimoRegistro.mes, ultimoRegistro.anio),
      funcionario: {
        rutFmt: ultimoRegistro.rutFmt,
        nombreFmt: ultimoRegistro.nombreFmt,
        nomSucursal: ultimoRegistro.nomSucursal,
      },
      contratos: contratos.map((c) => ({
        id: c.id,
        codUnidad: c.codUnidad,
        nomUnidad: c.nomUnidad,
        descripcionCargo: c.descripcionCargo,
        detalleCont: c.detalleCont,
        inicioContrato: c.inicioContrato,
        terminoContrato: c.terminoContrato,
        antiguedad: c.antiguedad,
        horas: c.horas,
        jornada: c.jornada,
        planta: c.planta,
        categoria: c.categoria,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error consultando datos de antigüedad.', detalle: err.message });
  }
});

app.get('/api/certificados/antiguedad/pdf', autenticarJWT, async (req: Request, res: Response) => {
  try {
    const targetRut =
      req.user!.rol === 'ADMIN' && req.query.rut
        ? Number(req.query.rut)
        : req.user!.rut;

    const ultimoRegistro = await prisma.liquidacionPersonal.findFirst({
      where: { rut: targetRut },
      orderBy: { periodo: 'desc' },
    });

    if (!ultimoRegistro) {
      res.status(404).json({ error: 'No se encontraron registros contractuales para emitir el certificado.' });
      return;
    }

    const contratos = await prisma.liquidacionPersonal.findMany({
      where: { rut: targetRut, periodo: ultimoRegistro.periodo },
      orderBy: { codUnidad: 'asc' },
    });

    const pdfBuffer = await generarPdfCertificadoAntiguedad(contratos);

    await registrarAuditoria(req, 'DESCARGA_CERT_ANTIGUEDAD', 'Certificado', {
      rut: targetRut,
      periodoReferencia: ultimoRegistro.periodo,
    });

    const filename = `antiguedad${targetRut}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(500).json({ error: 'Error generando Certificado de Antigüedad.', detalle: err.message });
  }
});

app.get('/api/mis-datos', autenticarJWT, async (req: Request, res: Response) => {
  try {
    const rut = req.user!.rut;
    const [usuario, ultimaLiq] = await Promise.all([
      prisma.usuario.findUnique({ where: { rut } }),
      prisma.liquidacionPersonal.findFirst({
        where: { rut },
        orderBy: { periodo: 'desc' },
      }),
    ]);

    res.json({
      usuario: usuario
        ? {
            rut: usuario.rut,
            dv: usuario.dv,
            rutFmt: usuario.rutFmt,
            nombreCompleto: usuario.nombreCompleto,
            email: usuario.email,
            telefono: usuario.telefono,
            cargo: usuario.cargo,
            unidad: usuario.unidad,
            departamento: usuario.departamento,
            rol: usuario.rol,
            fechaIngreso: usuario.fechaIngreso,
          }
        : null,
      fichaRemuneraciones: ultimaLiq
        ? {
            ...ultimaLiq,
            periodoFmt: formatearPeriodo(ultimaLiq.mes, ultimaLiq.anio),
          }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error obteniendo ficha de datos personales.', detalle: err.message });
  }
});

app.get('/api/mensajes/mis-mensajes', autenticarJWT, async (req: Request, res: Response) => {
  try {
    const mensajes = await prisma.mensajeContacto.findMany({
      where: { rut: req.user!.rut },
      orderBy: { fechaEnvio: 'desc' },
      take: 30,
    });
    res.json(mensajes);
  } catch (err: any) {
    res.status(500).json({ error: 'Error obteniendo historial de mensajes.', detalle: err.message });
  }
});

app.post('/api/mensajes', autenticarJWT, async (req: Request, res: Response) => {
  try {
    const { email, mensaje } = req.body;
    if (!email || !mensaje || String(mensaje).trim().length < 5) {
      res.status(400).json({ error: 'Debe indicar su correo de contacto y escribir un mensaje válido.' });
      return;
    }

    const nuevo = await prisma.mensajeContacto.create({
      data: {
        rut: req.user!.rut,
        rutFmt: req.user!.rutFmt,
        nombreUsuario: req.user!.nombreCompleto,
        email: String(email).trim().toLowerCase(),
        mensaje: String(mensaje).trim(),
        estado: 'PENDIENTE',
      },
    });

    await prisma.usuario.update({
      where: { rut: req.user!.rut },
      data: { email: String(email).trim().toLowerCase() },
    });

    await registrarAuditoria(req, 'ENVIO_MENSAJE_RRHH', 'Mensaje', {
      mensajeId: nuevo.id,
      email,
    });

    res.status(201).json({
      mensaje: 'Su consulta ha sido enviada exitosamente al Departamento de Recursos Humanos.',
      data: nuevo,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error enviando mensaje a RRHH.', detalle: err.message });
  }
});

// ============================================================================
// 3. ENDPOINTS DE ADMINISTRACIÓN (GESTIÓN DE PLANTILLAS, USUARIOS, MENSAJES, AUDITORÍA)
// ============================================================================

app.get('/api/admin/stats', autenticarJWT, requerirAdmin, async (_req: Request, res: Response) => {
  try {
    const [
      totalUsuarios,
      totalAdmins,
      usuariosBloqueados,
      usuariosNuevos,
      totalPeriodos,
      ultimoPeriodo,
      mensajesPendientes,
      mensajesTotales,
      totalLiquidaciones,
      ultimosEventos,
    ] = await Promise.all([
      prisma.usuario.count(),
      prisma.usuario.count({ where: { rol: 'ADMIN' } }),
      prisma.usuario.count({ where: { bloqueado: true } }),
      prisma.usuario.count({ where: { esNuevo: true } }),
      prisma.procesoCarga.count(),
      prisma.procesoCarga.findFirst({
        where: { filasPersonal: { gt: 0 } },
        orderBy: { periodo: 'desc' },
      }),
      prisma.mensajeContacto.count({ where: { estado: 'PENDIENTE' } }),
      prisma.mensajeContacto.count(),
      prisma.liquidacionPersonal.count(),
      prisma.auditLog.findMany({
        orderBy: { fecha: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      usuarios: {
        total: totalUsuarios,
        admins: totalAdmins,
        bloqueados: usuariosBloqueados,
        nuevos: usuariosNuevos,
      },
      procesos: {
        totalPeriodos,
        totalLiquidacionesEnDb: totalLiquidaciones,
        ultimoPeriodo,
      },
      mensajes: {
        pendientes: mensajesPendientes,
        totales: mensajesTotales,
      },
      ultimosEventos,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error obteniendo estadísticas de administración.', detalle: err.message });
  }
});

app.get('/api/admin/usuarios', autenticarJWT, requerirAdmin, async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || '').trim();
    const rol = String(req.query.rol || '').trim();
    const estado = String(req.query.estado || '').trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 25)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (rol === 'ADMIN' || rol === 'FUNCIONARIO') {
      where.rol = rol;
    }
    if (estado === 'BLOQUEADO') {
      where.bloqueado = true;
    } else if (estado === 'ACTIVO') {
      where.bloqueado = false;
    } else if (estado === 'NUEVO') {
      where.esNuevo = true;
    }

    if (search) {
      const numDigits = search.replace(/\D/g, '');
      const orConds: any[] = [
        { nombreCompleto: { contains: search, mode: 'insensitive' } },
        { rutFmt: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cargo: { contains: search, mode: 'insensitive' } },
        { unidad: { contains: search, mode: 'insensitive' } },
      ];
      if (numDigits && !Number.isNaN(parseInt(numDigits, 10))) {
        orConds.push({ rut: parseInt(numDigits, 10) });
        if (numDigits.length >= 7) {
          orConds.push({ rut: parseInt(numDigits.slice(0, -1), 10) });
        }
      }
      where.OR = orConds;
    }

    const [total, items] = await Promise.all([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        orderBy: [{ rol: 'asc' }, { apellidoPaterno: 'asc' }, { rut: 'asc' }],
        skip,
        take: limit,
        select: {
          id: true,
          rut: true,
          dv: true,
          rutFmt: true,
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          nombreCompleto: true,
          email: true,
          telefono: true,
          cargo: true,
          unidad: true,
          departamento: true,
          rol: true,
          bloqueado: true,
          esNuevo: true,
          fechaIngreso: true,
          updatedAt: true,
          modificadoPor: true,
        },
      }),
    ]);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error listando usuarios.', detalle: err.message });
  }
});

app.post('/api/admin/usuarios', autenticarJWT, requerirAdmin, async (req: Request, res: Response) => {
  try {
    const {
      rut: rutRaw,
      nombres,
      apellidoPaterno,
      apellidoMaterno,
      email,
      telefono,
      cargo,
      unidad,
      departamento,
      rol,
      password,
    } = req.body;

    const candidatos = extraerCandidatosRut(String(rutRaw || ''));
    if (candidatos.length === 0) {
      res.status(400).json({ error: 'RUT inválido.' });
      return;
    }

    const rut = candidatos[0];
    const dv = calcularDv(rut);
    const rutFmt = formatearRut(rut, dv);
    const nombreCompleto = `${nombres || ''} ${apellidoPaterno || ''} ${apellidoMaterno || ''}`
      .replace(/\s+/g, ' ')
      .trim() || `Funcionario ${rutFmt}`;

    const claveInicial = password ? String(password).trim() : String(rut).slice(-4);
    const passwordHash = await hashearPassword(claveInicial);

    const usuario = await prisma.usuario.upsert({
      where: { rut },
      create: {
        rut,
        dv,
        rutFmt,
        nombres: nombres || null,
        apellidoPaterno: apellidoPaterno || null,
        apellidoMaterno: apellidoMaterno || null,
        nombreCompleto,
        email: email || null,
        telefono: telefono || null,
        cargo: cargo || null,
        unidad: unidad || null,
        departamento: departamento || 'CMDS',
        passwordHash,
        rol: rol === 'ADMIN' ? 'ADMIN' : 'FUNCIONARIO',
        bloqueado: false,
        esNuevo: true,
        modificadoPor: req.user!.rutFmt,
      },
      update: {
        nombres: nombres || undefined,
        apellidoPaterno: apellidoPaterno || undefined,
        apellidoMaterno: apellidoMaterno || undefined,
        nombreCompleto,
        email: email || undefined,
        telefono: telefono || undefined,
        cargo: cargo || undefined,
        unidad: unidad || undefined,
        departamento: departamento || undefined,
        rol: rol === 'ADMIN' ? 'ADMIN' : 'FUNCIONARIO',
        modificadoPor: req.user!.rutFmt,
      },
    });

    await registrarAuditoria(req, 'CREAR_EDITAR_USUARIO', 'Usuario', {
      rut: usuario.rut,
      rol: usuario.rol,
    });

    res.json({
      mensaje: `Usuario ${usuario.rutFmt} guardado correctamente.`,
      usuario,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error guardando usuario.', detalle: err.message });
  }
});

app.patch('/api/admin/usuarios/:rut', autenticarJWT, requerirAdmin, async (req: Request, res: Response) => {
  try {
    const rut = Number(req.params.rut);
    const { rol, bloqueado, resetPassword, nuevaPassword, limpiarPreguntas, email } = req.body;

    const existente = await prisma.usuario.findUnique({ where: { rut } });
    if (!existente) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const dataUpdate: any = {
      modificadoPor: req.user!.rutFmt,
    };

    if (rol === 'ADMIN' || rol === 'FUNCIONARIO') {
      dataUpdate.rol = rol;
    }
    if (typeof bloqueado === 'boolean') {
      dataUpdate.bloqueado = bloqueado;
    }
    if (typeof email === 'string') {
      dataUpdate.email = email.trim().toLowerCase() || null;
    }

    let claveAsignada: string | null = null;
    if (resetPassword) {
      claveAsignada = nuevaPassword ? String(nuevaPassword).trim() : String(rut).slice(-4);
      dataUpdate.passwordHash = await hashearPassword(claveAsignada);
      dataUpdate.esNuevo = true;
      dataUpdate.bloqueado = false;
    }

    const actualizado = await prisma.usuario.update({
      where: { rut },
      data: dataUpdate,
    });

    if (limpiarPreguntas) {
      await prisma.respuestaSeguridad.deleteMany({ where: { rut } });
    }

    await registrarAuditoria(req, 'MODIFICAR_USUARIO', 'Usuario', {
      rut,
      rol: dataUpdate.rol,
      bloqueado: dataUpdate.bloqueado,
      resetPassword: Boolean(resetPassword),
      limpiarPreguntas: Boolean(limpiarPreguntas),
    });

    res.json({
      mensaje: resetPassword
        ? `Clave restablecida a "${claveAsignada}" (se solicitará cambio al ingresar).`
        : 'Usuario actualizado correctamente.',
      usuario: actualizado,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error actualizando usuario.', detalle: err.message });
  }
});

// Gestión de Plantillas CSV (Personal y Renta)
app.get('/api/admin/plantillas', autenticarJWT, requerirAdmin, async (_req: Request, res: Response) => {
  try {
    const procesos = await prisma.procesoCarga.findMany({
      orderBy: { periodo: 'desc' },
    });

    const enriquecidos = procesos.map((p) => {
      const existePersonalCsv =
        p.nomArchPersonal && fs.existsSync(path.join(LEGACY_UPLOAD_DIR, p.nomArchPersonal));
      const existeRentaCsv =
        p.nomArchRenta && fs.existsSync(path.join(LEGACY_UPLOAD_DIR, p.nomArchRenta));
      return {
        ...p,
        respaldoDisponible: Boolean(existePersonalCsv || existeRentaCsv),
        enBaseDatos: p.filasPersonal > 0 || p.filasRenta > 0,
      };
    });

    res.json(enriquecidos);
  } catch (err: any) {
    res.status(500).json({ error: 'Error obteniendo procesos de carga.', detalle: err.message });
  }
});

app.post('/api/admin/plantillas/validar', autenticarJWT, requerirAdmin, async (req: Request, res: Response) => {
  try {
    const mes = Number(req.body.mes);
    const anio = Number(req.body.anio);
    const tipo = String(req.body.tipo || 'P').toUpperCase();
    const periodo = anio * 100 + mes;

    const proc = await prisma.procesoCarga.findUnique({ where: { periodo } });
    const existe =
      proc &&
      ((tipo === 'P' && (proc.filasPersonal > 0 || proc.nomArchPersonal)) ||
        (tipo === 'R' && (proc.filasRenta > 0 || proc.nomArchRenta)));

    res.json({
      periodo,
      periodoFmt: formatearPeriodo(mes, anio),
      existe: Boolean(existe),
      proceso: proc,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error validando período.', detalle: err.message });
  }
});

app.post(
  '/api/admin/plantillas/cargar',
  autenticarJWT,
  requerirAdmin,
  upload.single('archivo'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      const mes = Number(req.body.mes);
      const anio = Number(req.body.anio);
      const tipo = String(req.body.tipo || '').toUpperCase(); // 'P' = Personal, 'R' = Renta

      if (!file) {
        res.status(400).json({ error: 'Debe adjuntar un archivo CSV válido.' });
        return;
      }
      if (!mes || mes < 1 || mes > 12 || !anio || anio < 2015 || anio > 2035) {
        res.status(400).json({ error: 'Mes o año de proceso inválido.' });
        return;
      }
      if (tipo !== 'P' && tipo !== 'R') {
        res.status(400).json({ error: 'El tipo de plantilla debe ser "P" (Personal) o "R" (Renta).' });
        return;
      }

      if (tipo === 'P') {
        const resultado = await procesarPlantillaPersonal(
          prisma,
          file.buffer,
          file.originalname,
          mes,
          anio,
          req.user!.rutFmt
        );

        await registrarAuditoria(req, 'CARGA_PLANTILLA_PERSONAL', 'Plantilla', {
          periodo: resultado.periodo,
          archivo: file.originalname,
          filasInsertadas: resultado.filasInsertadas,
          nuevosUsuarios: resultado.nuevosUsuarios,
        });

        res.json({
          mensaje: `Plantilla de Personal (${formatearPeriodo(mes, anio)}) cargada exitosamente: ${resultado.filasInsertadas.toLocaleString('es-CL')} registros procesados y ${resultado.nuevosUsuarios} nuevos funcionarios habilitados.`,
          ...resultado,
        });
      } else {
        const resultado = await procesarPlantillaRenta(
          prisma,
          file.buffer,
          file.originalname,
          mes,
          anio,
          req.user!.rutFmt
        );

        await registrarAuditoria(req, 'CARGA_PLANTILLA_RENTA', 'Plantilla', {
          periodo: resultado.periodo,
          archivo: file.originalname,
          filasInsertadas: resultado.filasInsertadas,
        });

        res.json({
          mensaje: `Plantilla de Renta (${formatearPeriodo(mes, anio)}) cargada exitosamente: ${resultado.filasInsertadas.toLocaleString('es-CL')} detalles de haberes/descuentos procesados.`,
          ...resultado,
        });
      }
    } catch (err: any) {
      console.error('Error cargando plantilla CSV:', err);
      res.status(400).json({ error: err.message || 'Error procesando plantilla CSV.' });
    }
  }
);

// Importar un período histórico directamente desde la carpeta de respaldo U:\BKP-TOTEM-WEB\html\totem-admin\public\upload
app.post(
  '/api/admin/plantillas/:periodo/importar-respaldo',
  autenticarJWT,
  requerirAdmin,
  async (req: Request, res: Response) => {
    try {
      const periodo = Number(req.params.periodo);
      const proc = await prisma.procesoCarga.findUnique({ where: { periodo } });
      if (!proc) {
        res.status(404).json({ error: 'Período no encontrado en el registro de procesos.' });
        return;
      }

      let filasPersonal = proc.filasPersonal;
      let filasRenta = proc.filasRenta;

      if (proc.nomArchPersonal) {
        const pPath = path.join(LEGACY_UPLOAD_DIR, proc.nomArchPersonal);
        if (fs.existsSync(pPath)) {
          const buf = fs.readFileSync(pPath);
          const resP = await procesarPlantillaPersonal(
            prisma,
            buf,
            proc.nomArchPersonal,
            proc.mes,
            proc.anio,
            req.user!.rutFmt
          );
          filasPersonal = resP.filasInsertadas;
        }
      }

      if (proc.nomArchRenta) {
        const rPath = path.join(LEGACY_UPLOAD_DIR, proc.nomArchRenta);
        if (fs.existsSync(rPath)) {
          const buf = fs.readFileSync(rPath);
          const resR = await procesarPlantillaRenta(
            prisma,
            buf,
            proc.nomArchRenta,
            proc.mes,
            proc.anio,
            req.user!.rutFmt
          );
          filasRenta = resR.filasInsertadas;
        }
      }

      await registrarAuditoria(req, 'IMPORTAR_RESPALDO_HISTORICO', 'Plantilla', {
        periodo,
        filasPersonal,
        filasRenta,
      });

      res.json({
        mensaje: `Período ${proc.periodoFmt} importado a PostgreSQL (${filasPersonal.toLocaleString('es-CL')} fichas de personal y ${filasRenta.toLocaleString('es-CL')} ítems de renta).`,
        periodo,
        filasPersonal,
        filasRenta,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error importando período desde respaldo.', detalle: err.message });
    }
  }
);

app.delete('/api/admin/plantillas/:periodo', autenticarJWT, requerirAdmin, async (req: Request, res: Response) => {
  try {
    const periodo = Number(req.params.periodo);
    await prisma.$transaction([
      prisma.liquidacionPersonal.deleteMany({ where: { periodo } }),
      prisma.liquidacionRenta.deleteMany({ where: { periodo } }),
      prisma.procesoCarga.update({
        where: { periodo },
        data: {
          filasPersonal: 0,
          filasRenta: 0,
          estadoProceso: 'VACIADO',
        },
      }),
    ]);

    await registrarAuditoria(req, 'ELIMINAR_CARGA_PERIODO', 'Plantilla', { periodo });
    res.json({ mensaje: `Datos del período ${periodo} eliminados de la base de datos.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Error eliminando carga del período.', detalle: err.message });
  }
});

// Bandeja de Mensajes RRHH
app.get('/api/admin/mensajes', autenticarJWT, requerirAdmin, async (req: Request, res: Response) => {
  try {
    const estado = String(req.query.estado || 'TODOS').toUpperCase();
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 25)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (estado === 'PENDIENTE' || estado === 'LEIDO') {
      where.estado = estado;
    }
    if (search) {
      where.OR = [
        { nombreUsuario: { contains: search, mode: 'insensitive' } },
        { rutFmt: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mensaje: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.mensajeContacto.count({ where }),
      prisma.mensajeContacto.findMany({
        where,
        orderBy: { fechaEnvio: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error obteniendo bandeja de mensajes.', detalle: err.message });
  }
});

app.patch('/api/admin/mensajes/:id', autenticarJWT, requerirAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const estado = String(req.body.estado || 'LEIDO').toUpperCase();

    const actualizado = await prisma.mensajeContacto.update({
      where: { id },
      data: {
        estado: estado === 'PENDIENTE' ? 'PENDIENTE' : 'LEIDO',
        fechaMod: new Date(),
        usuarioMod: req.user!.rutFmt,
      },
    });

    await registrarAuditoria(req, 'ACTUALIZAR_MENSAJE', 'Mensaje', { id, estado: actualizado.estado });
    res.json(actualizado);
  } catch (err: any) {
    res.status(500).json({ error: 'Error actualizando estado del mensaje.', detalle: err.message });
  }
});

// Registro de Auditoría
app.get('/api/admin/auditoria', autenticarJWT, requerirAdmin, async (req: Request, res: Response) => {
  try {
    const accion = String(req.query.accion || '').trim();
    const search = String(req.query.search || '').trim();
    const limit = Math.min(200, Math.max(20, Number(req.query.limit || 50)));

    const where: any = {};
    if (accion && accion !== 'TODAS') {
      where.accion = accion;
    }
    if (search) {
      where.OR = [
        { rutUsuario: { contains: search, mode: 'insensitive' } },
        { nombreUsuario: { contains: search, mode: 'insensitive' } },
        { detalles: { contains: search, mode: 'insensitive' } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: limit,
    });

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'Error obteniendo registros de auditoría.', detalle: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend Totem CMDS 2026 escuchando en http://localhost:${PORT}`);
});
