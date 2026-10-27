import { PrismaClient } from '@prisma/client';
import { calcularDv, formatearPeriodo, formatearRut } from '../utils/rut';

function decodeCsvBuffer(buffer: Buffer): string {
  // Detect if valid UTF-8, otherwise decode as latin1 (ISO-8859-1) which is standard in CMDS payroll exports
  const utf8Text = buffer.toString('utf8');
  if (utf8Text.includes('\uFFFD')) {
    return buffer.toString('latin1');
  }
  return utf8Text;
}

function cleanStr(val: string | undefined): string {
  if (!val) return '';
  return val.replace(/^"|"$/g, '').trim();
}

function toInt(val: string | undefined): number {
  const s = cleanStr(val).replace(/\./g, '').replace(/,/g, '.');
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}

function toFloat(val: string | undefined, defaultVal = 0): number {
  const s = cleanStr(val).replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? defaultVal : n;
}

export async function procesarPlantillaPersonal(
  prisma: PrismaClient,
  buffer: Buffer,
  fileName: string,
  mes: number,
  anio: number,
  cargadoPorRut?: string
): Promise<{ filasInsertadas: number; nuevosUsuarios: number; periodo: number }> {
  const periodo = anio * 100 + mes;
  const content = decodeCsvBuffer(buffer);
  const lines = content.split(/\r?\n/);

  const rowsToInsert: any[] = [];
  const userProfileMap = new Map<
    number,
    {
      rut: number;
      dv: string;
      rutFmt: string;
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

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const cols = rawLine.split(';');
    if (cols.length < 60) continue;

    // Saltar fila de encabezado (CODIGO;NOMBRE_SUCURSAL;...)
    const col0 = cleanStr(cols[0]).toUpperCase();
    const col4 = cleanStr(cols[4]).toUpperCase();
    if (col0 === 'CODIGO' || col4 === 'RUT' || Number.isNaN(parseInt(col4, 10))) {
      continue;
    }

    const rut = toInt(cols[4]);
    if (!rut || rut <= 0) continue;

    const dvRaw = cleanStr(cols[5]).toUpperCase();
    const dv = dvRaw || calcularDv(rut);
    const rutFmt = formatearRut(rut, dv);

    const apePaterno = cleanStr(cols[6]);
    const apeMaterno = cleanStr(cols[7]);
    const nombre = cleanStr(cols[8]);
    const nombreFmt = `${nombre} ${apePaterno} ${apeMaterno}`.replace(/\s+/g, ' ').trim();

    const totNormal = toInt(cols[27]);
    const totInvalida = toInt(cols[28]);
    const totMaternal = toInt(cols[29]);
    const nroCargas = totNormal + totInvalida + totMaternal;

    const totHaberes = toInt(cols[44]);
    const totDesctos = toInt(cols[45]);
    const liquidoPago = totHaberes - totDesctos;

    const nroCuenta = cleanStr(cols[61]);
    const formaPago =
      nroCuenta && nroCuenta !== '0' && nroCuenta !== '' ? 'ABONO EN CTA.' : 'PAGO DIRECTO';

    const nomSucursal = cleanStr(cols[1]);
    const nomUnidad = cleanStr(cols[3]);
    const descripcionCargo = cleanStr(cols[16]);
    const telefono = cleanStr(cols[58]);

    rowsToInsert.push({
      periodo,
      mes,
      anio,
      codSucursal: toInt(cols[0]),
      nomSucursal,
      codUnidad: toInt(cols[2]),
      nomUnidad,
      rut,
      dv,
      rutFmt,
      apePaterno,
      apeMaterno,
      nombre,
      nombreFmt,
      sexo: cleanStr(cols[9]) || null,
      fecNacimiento: cleanStr(cols[10]) || null,
      edad: toInt(cols[11]) || null,
      detalleCont: cleanStr(cols[12]) || null,
      planta: cleanStr(cols[13]) || null,
      escala: cleanStr(cols[14]) || null,
      categoria: cleanStr(cols[15]) || null,
      descripcionCargo: descripcionCargo || null,
      horas: toFloat(cols[17], 0),
      jornada: cleanStr(cols[18]) || null,
      bienios: toInt(cols[19]),
      proxBienio: cleanStr(cols[20]) || null,
      grado: cleanStr(cols[21]) || null,
      letra: cleanStr(cols[22]) || null,
      inicioContrato: cleanStr(cols[23]) || null,
      terminoContrato: cleanStr(cols[24]) || null,
      antiguedad: cleanStr(cols[25]) || null,
      vigencia: cleanStr(cols[26]) || null,
      totNormal,
      totInvalida,
      totMaternal,
      nroCargas,
      codAfp: cleanStr(cols[30]) || null,
      nomAfp: cleanStr(cols[31]) || null,
      porcAfp: cleanStr(cols[32]) || null,
      porcAdicional: cleanStr(cols[33]) || null,
      inva: cleanStr(cols[34]) || null,
      adminAfp: cleanStr(cols[35]) || null,
      rebaja: cleanStr(cols[36]) || null,
      codSalud: cleanStr(cols[37]) || null,
      nomSalud: cleanStr(cols[38]) || null,
      porcFijoSalud: cleanStr(cols[39]) || null,
      montoFijoSalud: cleanStr(cols[40]) || null,
      montoPesoSalud: cleanStr(cols[41]) || null,
      porcAportePat: cleanStr(cols[42]) || null,
      mtoAportePat: toInt(cols[43]),
      totHaberes,
      totDesctos,
      sdoImponib: toInt(cols[46]),
      montoImponi: toInt(cols[47]),
      mtoCotiza: toInt(cols[48]),
      mtoAdic: toInt(cols[49]),
      mtoSalud: toInt(cols[50]),
      tributa: toInt(cols[51]),
      liquidoPago,
      diasTrab: toFloat(cols[52], 30),
      mtoPorcen: toInt(cols[53]),
      cesEmpleado: toInt(cols[54]),
      cesEmpleador: toInt(cols[55]),
      invEmpleador: toInt(cols[56]),
      direccion: cleanStr(cols[57]) || null,
      telefono: telefono || null,
      nacionalidad: cleanStr(cols[59]) || null,
      estadoCivil: cleanStr(cols[60]) || null,
      formaPago,
      nroCuenta: nroCuenta || null,
      razonSocialBanco: cleanStr(cols[62]) || null,
      escolaridad: cleanStr(cols[63]) || null,
      codTitulo: cleanStr(cols[64]) || null,
      descTitulo: cleanStr(cols[65]) || null,
      codEspec: cleanStr(cols[66]) || null,
      descEspec: cleanStr(cols[67]) || null,
    });

    userProfileMap.set(rut, {
      rut,
      dv,
      rutFmt,
      nombres: nombre,
      apellidoPaterno: apePaterno,
      apellidoMaterno: apeMaterno,
      nombreCompleto: nombreFmt,
      telefono,
      cargo: descripcionCargo,
      unidad: nomUnidad,
      departamento: nomSucursal,
    });
  }

  if (rowsToInsert.length === 0) {
    throw new Error(
      'El archivo CSV de Personal no contiene filas válidas (se esperan 68 columnas separadas por punto y coma).'
    );
  }

  // Reemplazar datos previos de Personal para este período
  await prisma.liquidacionPersonal.deleteMany({ where: { periodo } });

  const CHUNK_SIZE = 2500;
  for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.liquidacionPersonal.createMany({ data: chunk });
  }

  // Provisionar usuarios nuevos que no existan en la tabla Usuario (con clave inicial = últimos 4 dígitos del RUT)
  const rutsEnArchivo = Array.from(userProfileMap.keys());
  const existentes = await prisma.usuario.findMany({
    where: { rut: { in: rutsEnArchivo } },
    select: { rut: true },
  });
  const setExistentes = new Set(existentes.map((u) => u.rut));

  const nuevosUsuariosData = rutsEnArchivo
    .filter((r) => !setExistentes.has(r))
    .map((r) => {
      const p = userProfileMap.get(r)!;
      const claveInicial4Digitos = String(r).slice(-4);
      return {
        rut: p.rut,
        dv: p.dv,
        rutFmt: p.rutFmt,
        nombres: p.nombres,
        apellidoPaterno: p.apellidoPaterno,
        apellidoMaterno: p.apellidoMaterno,
        nombreCompleto: p.nombreCompleto,
        telefono: p.telefono || null,
        cargo: p.cargo || null,
        unidad: p.unidad || null,
        departamento: p.departamento || null,
        passwordHash: `PLAIN:${claveInicial4Digitos}`,
        rol: 'FUNCIONARIO',
        bloqueado: false,
        esNuevo: true,
        modificadoPor: cargadoPorRut || 'CARGA_PLANTILLA',
      };
    });

  if (nuevosUsuariosData.length > 0) {
    await prisma.usuario.createMany({
      data: nuevosUsuariosData,
      skipDuplicates: true,
    });
  }

  // Actualizar estado del ProcesoCarga
  const existenteProc = await prisma.procesoCarga.findUnique({ where: { periodo } });
  const tieneRenta = (existenteProc?.filasRenta || 0) > 0;

  await prisma.procesoCarga.upsert({
    where: { periodo },
    create: {
      periodo,
      mes,
      anio,
      periodoFmt: formatearPeriodo(mes, anio),
      nomArchPersonal: fileName,
      filasPersonal: rowsToInsert.length,
      filasRenta: 0,
      estadoProceso: 'PARCIAL',
      cargadoPorRut: cargadoPorRut || 'ADMIN',
    },
    update: {
      nomArchPersonal: fileName,
      filasPersonal: rowsToInsert.length,
      estadoProceso: tieneRenta ? 'COMPLETADO' : 'PARCIAL',
      fechaCarga: new Date(),
      cargadoPorRut: cargadoPorRut || existenteProc?.cargadoPorRut || 'ADMIN',
    },
  });

  return {
    filasInsertadas: rowsToInsert.length,
    nuevosUsuarios: nuevosUsuariosData.length,
    periodo,
  };
}

export async function procesarPlantillaRenta(
  prisma: PrismaClient,
  buffer: Buffer,
  fileName: string,
  mes: number,
  anio: number,
  cargadoPorRut?: string
): Promise<{ filasInsertadas: number; periodo: number }> {
  const periodo = anio * 100 + mes;
  const content = decodeCsvBuffer(buffer);
  const lines = content.split(/\r?\n/);

  const rowsToInsert: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const cols = rawLine.split(';');
    if (cols.length < 12) continue;

    const col0 = cleanStr(cols[0]).toUpperCase();
    const col1 = cleanStr(cols[1]).toUpperCase();
    if (col0 === 'UNIDAD' || col1 === 'RUT' || Number.isNaN(parseInt(col1, 10))) {
      continue;
    }

    const rut = toInt(cols[1]);
    if (!rut || rut <= 0) continue;

    const dv = cleanStr(cols[2]).toUpperCase() || calcularDv(rut);

    rowsToInsert.push({
      periodo,
      codUnidad: toInt(cols[0]),
      rut,
      dv,
      paterno: cleanStr(cols[3]) || null,
      materno: cleanStr(cols[4]) || null,
      nombre: cleanStr(cols[5]) || null,
      codHaber: toInt(cols[6]),
      nomHaber: cleanStr(cols[7]) || null,
      montoHaber: toInt(cols[8]),
      codDescuento: toInt(cols[9]),
      nomDescuento: cleanStr(cols[10]) || null,
      montoDescuento: toInt(cols[11]),
      mes: toInt(cols[12]) || mes,
      anio: toInt(cols[13]) || anio,
    });
  }

  if (rowsToInsert.length === 0) {
    throw new Error(
      'El archivo CSV de Renta no contiene filas válidas (se esperan 14 columnas separadas por punto y coma).'
    );
  }

  await prisma.liquidacionRenta.deleteMany({ where: { periodo } });

  const CHUNK_SIZE = 4000;
  for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.liquidacionRenta.createMany({ data: chunk });
  }

  const existenteProc = await prisma.procesoCarga.findUnique({ where: { periodo } });
  const tienePersonal = (existenteProc?.filasPersonal || 0) > 0;

  await prisma.procesoCarga.upsert({
    where: { periodo },
    create: {
      periodo,
      mes,
      anio,
      periodoFmt: formatearPeriodo(mes, anio),
      nomArchRenta: fileName,
      filasPersonal: 0,
      filasRenta: rowsToInsert.length,
      estadoProceso: 'PARCIAL',
      cargadoPorRut: cargadoPorRut || 'ADMIN',
    },
    update: {
      nomArchRenta: fileName,
      filasRenta: rowsToInsert.length,
      estadoProceso: tienePersonal ? 'COMPLETADO' : 'PARCIAL',
      fechaCarga: new Date(),
      cargadoPorRut: cargadoPorRut || existenteProc?.cargadoPorRut || 'ADMIN',
    },
  });

  return {
    filasInsertadas: rowsToInsert.length,
    periodo,
  };
}
