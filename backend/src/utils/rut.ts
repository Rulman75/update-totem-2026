import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const MESES_NOMBRES: Record<number, string> = {
  1: 'Enero',
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  7: 'Julio',
  8: 'Agosto',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
};

export function formatearPeriodo(mes: number, anio: number): string {
  return `${MESES_NOMBRES[mes] || `Mes ${mes}`} ${anio}`;
}

export function calcularDv(rut: number | string): string {
  const clean = String(rut).replace(/\D/g, '');
  if (!clean) return '0';
  let suma = 0;
  let multiplo = 2;
  for (let i = clean.length - 1; i >= 0; i--) {
    suma += parseInt(clean.charAt(i), 10) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

export function formatearRut(rutNumerico: number | string, dv?: string): string {
  const cleanNum = String(rutNumerico).replace(/\D/g, '');
  if (!cleanNum) return '';
  const finalDv = (dv || calcularDv(cleanNum)).toUpperCase();
  const conPuntos = cleanNum.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${conPuntos}-${finalDv}`;
}

/**
 * Extrae posibles RUTs numéricos (sin DV) desde cualquier formato ingresado por el usuario:
 * - Sin puntos ni guión con DV (estilo Totem clásico): "106334471" o "10293945K" -> [10633447, ...]
 * - Sin puntos ni guión y sin DV: "10633447" -> [10633447, ...]
 * - Con guión: "10633447-1" -> [10633447, ...]
 * - Con puntos y guión: "10.633.447-1" -> [10633447, ...]
 */
export function extraerCandidatosRut(input: string): number[] {
  const trimmed = (input || '').trim().toUpperCase();
  if (!trimmed) return [];

  const candidatos: number[] = [];
  const addCandidato = (n: number) => {
    if (!Number.isNaN(n) && n > 0 && !candidatos.includes(n)) {
      candidatos.push(n);
    }
  };

  // Si incluye guión explícito (ej: "10633447-1" o "10.633.447-1")
  if (trimmed.includes('-')) {
    const [parteNum] = trimmed.split('-');
    const digits = parteNum.replace(/\D/g, '');
    addCandidato(parseInt(digits, 10));
  }

  const clean = trimmed.replace(/[^0-9K]/g, '');
  if (!clean) return candidatos;

  // Si termina en K, el cuerpo numérico es todo menos la K
  if (clean.endsWith('K')) {
    const sinDv = parseInt(clean.slice(0, -1).replace(/\D/g, ''), 10);
    addCandidato(sinDv);
    return candidatos;
  }

  // Solo dígitos (ej: "106334471" con DV o "10633447" sin DV)
  if (clean.length >= 7) {
    const cuerpo = clean.slice(0, -1);
    const dvIngresado = clean.slice(-1);
    // Si el último dígito coincide con el DV Módulo 11 del cuerpo, priorizar el cuerpo sin DV
    if (calcularDv(cuerpo) === dvIngresado) {
      addCandidato(parseInt(cuerpo, 10));
      addCandidato(parseInt(clean, 10));
    } else {
      // Si no coincide con el DV Módulo 11, el usuario probablemente ingresó el RUT directo sin DV (ej: "10633447")
      addCandidato(parseInt(clean, 10));
      addCandidato(parseInt(cuerpo, 10));
    }
  } else {
    addCandidato(parseInt(clean, 10));
  }

  return candidatos;
}

export async function verificarPassword(
  plainPassword: string,
  storedHash: string
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!storedHash || !plainPassword) {
    return { valid: false, needsUpgrade: false };
  }

  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    const valid = await bcrypt.compare(plainPassword, storedHash);
    return { valid, needsUpgrade: false };
  }

  if (storedHash.startsWith('MD5:')) {
    const targetHex = storedHash.slice(4).trim().toUpperCase();
    const md5Exact = crypto.createHash('md5').update(plainPassword, 'utf8').digest('hex').toUpperCase();
    const md5Trim = crypto.createHash('md5').update(plainPassword.trim(), 'utf8').digest('hex').toUpperCase();
    const md5TrimUpper = crypto.createHash('md5').update(plainPassword.trim().toUpperCase(), 'utf8').digest('hex').toUpperCase();
    const md5TrimLower = crypto.createHash('md5').update(plainPassword.trim().toLowerCase(), 'utf8').digest('hex').toUpperCase();
    const valid =
      md5Exact === targetHex ||
      md5Trim === targetHex ||
      md5TrimUpper === targetHex ||
      md5TrimLower === targetHex;
    return { valid, needsUpgrade: valid };
  }

  if (storedHash.startsWith('PLAIN:')) {
    const targetPlain = storedHash.slice(6).trim();
    const valid = plainPassword.trim() === targetPlain;
    return { valid, needsUpgrade: valid };
  }

  if (/^[0-9a-fA-F]{32}$/.test(storedHash)) {
    const targetHex = storedHash.toUpperCase();
    const md5Exact = crypto.createHash('md5').update(plainPassword, 'utf8').digest('hex').toUpperCase();
    const valid = md5Exact === targetHex;
    return { valid, needsUpgrade: valid };
  }

  return { valid: false, needsUpgrade: false };
}

export async function hashearPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, 10);
}

export async function verificarRespuestaSeguridad(
  respuestaUsuario: string,
  storedHash: string
): Promise<boolean> {
  if (!respuestaUsuario || !storedHash) return false;
  const normalizada = respuestaUsuario.trim().toUpperCase();

  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    return bcrypt.compare(normalizada, storedHash);
  }

  const cleanTarget = storedHash.replace(/^MD5:/i, '').trim().toLowerCase();
  const md5Hex = crypto.createHash('md5').update(normalizada, 'utf8').digest('hex').toLowerCase();
  return md5Hex === cleanTarget;
}

export async function hashearRespuestaSeguridad(respuestaUsuario: string): Promise<string> {
  const normalizada = respuestaUsuario.trim().toUpperCase();
  return bcrypt.hash(normalizada, 10);
}
