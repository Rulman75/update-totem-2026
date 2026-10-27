import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { LiquidacionPersonal, LiquidacionRenta } from '@prisma/client';
import { MESES_NOMBRES } from '../utils/rut';

function fmtPesos(val: number | null | undefined): string {
  const num = Number(val || 0);
  return num.toLocaleString('es-CL');
}

function numeroALetras(num: number): string {
  if (num === 0) return 'CERO';
  if (num < 0) return `MENOS ${numeroALetras(Math.abs(num))}`;

  const unidades = [
    '',
    'UN',
    'DOS',
    'TRES',
    'CUATRO',
    'CINCO',
    'SEIS',
    'SIETE',
    'OCHO',
    'NUEVE',
    'DIEZ',
    'ONCE',
    'DOCE',
    'TRECE',
    'CATORCE',
    'QUINCE',
    'DIECISÉIS',
    'DIECISIETE',
    'DIECIOCHO',
    'DIECINUEVE',
    'VEINTE',
    'VEINTIÚN',
    'VEINTIDÓS',
    'VEINTITRÉS',
    'VEINTICUATRO',
    'VEINTICINCO',
    'VEINTISÉIS',
    'VEINTISIETE',
    'VEINTIOCHO',
    'VEINTINUEVE',
  ];
  const decenas = [
    '',
    'DIEZ',
    'VEINTE',
    'TREINTA',
    'CUARENTA',
    'CINCUENTA',
    'SESENTA',
    'SETENTA',
    'OCHENTA',
    'NOVENTA',
  ];
  const centenas = [
    '',
    'CIENTO',
    'DOSCIENTOS',
    'TRESCIENTOS',
    'CUATROCIENTOS',
    'QUINIENTOS',
    'SEISCIENTOS',
    'SETECIENTOS',
    'OCHOCIENTOS',
    'NOVECIENTOS',
  ];

  function convertirMenorMil(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    if (n < 30) return unidades[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return u === 0 ? decenas[d] : `${decenas[d]} Y ${unidades[u]}`;
    }
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return resto === 0 ? centenas[c] : `${centenas[c]} ${convertirMenorMil(resto)}`;
  }

  const millones = Math.floor(num / 1000000);
  const miles = Math.floor((num % 1000000) / 1000);
  const resto = num % 1000;

  const partes: string[] = [];
  if (millones === 1) {
    partes.push('UN MILLÓN');
  } else if (millones > 1) {
    partes.push(`${convertirMenorMil(millones)} MILLONES`);
  }

  if (miles === 1) {
    partes.push('MIL');
  } else if (miles > 1) {
    partes.push(`${convertirMenorMil(miles)} MIL`);
  }

  if (resto > 0) {
    partes.push(convertirMenorMil(resto));
  }

  return partes.join(' ').trim();
}

export async function generarPdfLiquidacion(
  personal: LiquidacionPersonal,
  rentas: LiquidacionRenta[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 28, bottom: 28, left: 28, right: 28 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const assetsDir = path.join(__dirname, '../../assets');
      const logoPath = path.join(assetsDir, 'logocmns.png');

      // 1. Encabezado Corporativo
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 30, 24, { width: 62 });
        } catch {
          // continuar sin imagen si hay error de formato
        }
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#0f172a')
        .text('CORPORACIÓN MUNICIPAL DE DESARROLLO SOCIAL', 100, 30)
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#334155')
        .text('DIRECCIÓN DE RECURSOS HUMANOS - ANTOFAGASTA', 100, 42)
        .text(`DEPARTAMENTO: ${personal.nomSucursal || 'CMDS'}`, 100, 53);

      const mesNombre = (MESES_NOMBRES[personal.mes] || `MES ${personal.mes}`).toUpperCase();
      doc
        .roundedRect(390, 26, 192, 40, 4)
        .fillAndStroke('#f1f5f9', '#cbd5e1');

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0f172a')
        .text('LIQUIDACIÓN DE SUELDO', 390, 33, { width: 192, align: 'center' })
        .fontSize(9)
        .fillColor('#1d4ed8')
        .text(`${mesNombre} DE ${personal.anio}`, 390, 48, { width: 192, align: 'center' });

      // 2. Bloque de Datos Personales y Contractuales
      const infoTop = 76;
      doc
        .roundedRect(28, infoTop, 556, 86, 4)
        .fillAndStroke('#ffffff', '#94a3b8');

      const drawField = (
        label: string,
        val: string,
        x: number,
        y: number,
        w: number
      ) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor('#475569')
          .text(label, x, y, { width: w, lineBreak: false });
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#0f172a')
          .text(val || '-', x, y + 8, { width: w, lineBreak: false, ellipsis: true });
      };

      // Fila 1
      drawField('R.U.T.', personal.rutFmt, 36, infoTop + 6, 85);
      drawField('NOMBRE FUNCIONARIO(A)', personal.nombreFmt, 125, infoTop + 6, 235);
      drawField('CARGO / FUNCIÓN', personal.descripcionCargo || '-', 365, infoTop + 6, 210);

      // Línea divisoria horizontal suave
      doc.moveTo(34, infoTop + 26).lineTo(578, infoTop + 26).strokeColor('#e2e8f0').stroke();

      // Fila 2
      drawField(
        'ESTABLECIMIENTO / UNIDAD',
        `${personal.codUnidad} - ${personal.nomUnidad}`,
        36,
        infoTop + 30,
        220
      );
      drawField('CALIDAD CONTRACTUAL', personal.detalleCont || '-', 260, infoTop + 30, 110);
      drawField(
        'JORNADA / HORAS',
        `${personal.horas ?? 0} HRS (${personal.jornada || '-'})`,
        375,
        infoTop + 30,
        115
      );
      drawField('PLANTA / CATEGORÍA', `${personal.planta || '-'} / ${personal.categoria || '-'}`, 495, infoTop + 30, 82);

      doc.moveTo(34, infoTop + 50).lineTo(578, infoTop + 50).strokeColor('#e2e8f0').stroke();

      // Fila 3
      drawField('FECHA INGRESO CMDS', personal.inicioContrato || '-', 36, infoTop + 55, 95);
      drawField('FECHA TÉRMINO', personal.terminoContrato || 'INDEFINIDO', 135, infoTop + 55, 85);
      drawField('BIENIOS', `${personal.bienios ?? 0}`, 225, infoTop + 55, 45);
      drawField('FORMA DE PAGO', personal.formaPago || '-', 275, infoTop + 55, 95);
      drawField('BANCO / N° CUENTA', `${personal.razonSocialBanco || ''} ${personal.nroCuenta || ''}`.trim() || '-', 375, infoTop + 55, 200);

      // 3. Franja Previsional y Tributaria
      const prevTop = 168;
      doc
        .roundedRect(28, prevTop, 556, 32, 4)
        .fillAndStroke('#f8fafc', '#94a3b8');

      drawField('DÍAS TRAB.', String(personal.diasTrab ?? 30), 36, prevTop + 6, 50);
      drawField('CARGAS FAM.', String(personal.nroCargas ?? 0), 90, prevTop + 6, 55);
      drawField(
        'A.F.P. / COTIZACIÓN',
        `${personal.nomAfp || '-'} (${personal.porcAfp || '0'}%)  $${fmtPesos(personal.mtoCotiza)}`,
        150,
        prevTop + 6,
        145
      );
      drawField(
        'SALUD / COTIZACIÓN',
        `${personal.nomSalud || '-'} (${personal.porcFijoSalud || '0'}%)  $${fmtPesos(personal.mtoSalud)}`,
        300,
        prevTop + 6,
        135
      );
      drawField('RENTA IMPONIBLE', `$ ${fmtPesos(personal.montoImponi)}`, 440, prevTop + 6, 70);
      drawField('RENTA TRIBUTABLE', `$ ${fmtPesos(personal.tributa)}`, 514, prevTop + 6, 66);

      // 4. Tabla de Haberes y Descuentos (Dos columnas paralelas)
      const tableTop = 208;
      const tableHeight = 415;
      const colWidth = 275;
      const leftX = 28;
      const rightX = 309;

      // Marcos de Haberes y Descuentos
      doc.roundedRect(leftX, tableTop, colWidth, tableHeight, 4).strokeColor('#94a3b8').stroke();
      doc.roundedRect(rightX, tableTop, colWidth, tableHeight, 4).strokeColor('#94a3b8').stroke();

      // Encabezados de tabla
      doc.rect(leftX, tableTop, colWidth, 20).fill('#016098');
      doc.rect(rightX, tableTop, colWidth, 20).fill('#016098');

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#ffffff')
        .text('CÓD.', leftX + 6, tableTop + 6, { width: 32 })
        .text('DETALLE DE HABERES', leftX + 40, tableTop + 6, { width: 165 })
        .text('MONTO $', leftX + 205, tableTop + 6, { width: 64, align: 'right' });

      doc
        .text('CÓD.', rightX + 6, tableTop + 6, { width: 32 })
        .text('DETALLE DE DESCUENTOS', rightX + 40, tableTop + 6, { width: 165 })
        .text('MONTO $', rightX + 205, tableTop + 6, { width: 64, align: 'right' });

      const haberes = rentas
        .filter((r) => (r.codHaber && r.codHaber > 0) || (r.montoHaber && r.montoHaber > 0))
        .sort((a, b) => a.codHaber - b.codHaber);

      const descuentos = rentas
        .filter((r) => (r.codDescuento && r.codDescuento > 0) || (r.montoDescuento && r.montoDescuento > 0))
        .sort((a, b) => a.codDescuento - b.codDescuento);

      const maxRows = 32;
      const rowH = 11.8;

      doc.font('Helvetica').fontSize(7.2).fillColor('#0f172a');

      haberes.slice(0, maxRows).forEach((h, idx) => {
        const y = tableTop + 25 + idx * rowH;
        if (idx % 2 === 1) {
          doc.rect(leftX + 1, y - 1.5, colWidth - 2, rowH).fill('#f8fafc');
          doc.fillColor('#0f172a');
        }
        doc.text(String(h.codHaber), leftX + 6, y, { width: 32, lineBreak: false });
        doc.text(h.nomHaber || '', leftX + 40, y, { width: 165, lineBreak: false, ellipsis: true });
        doc.text(fmtPesos(h.montoHaber), leftX + 205, y, { width: 64, align: 'right', lineBreak: false });
      });

      descuentos.slice(0, maxRows).forEach((d, idx) => {
        const y = tableTop + 25 + idx * rowH;
        if (idx % 2 === 1) {
          doc.rect(rightX + 1, y - 1.5, colWidth - 2, rowH).fill('#f8fafc');
          doc.fillColor('#0f172a');
        }
        doc.text(String(d.codDescuento), rightX + 6, y, { width: 32, lineBreak: false });
        doc.text(d.nomDescuento || '', rightX + 40, y, { width: 165, lineBreak: false, ellipsis: true });
        doc.text(fmtPesos(d.montoDescuento), rightX + 205, y, { width: 64, align: 'right', lineBreak: false });
      });

      // 5. Resumen de Totales y Alcance Líquido
      const totTop = 630;
      doc
        .roundedRect(28, totTop, 556, 62, 4)
        .fillAndStroke('#f8fafc', '#64748b');

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#0f172a')
        .text('TOTAL HABERES:', 38, totTop + 10)
        .text(`$ ${fmtPesos(personal.totHaberes)}`, 140, totTop + 10, { width: 140, align: 'right' });

      doc
        .text('TOTAL DESCUENTOS:', 318, totTop + 10)
        .text(`$ ${fmtPesos(personal.totDesctos)}`, 430, totTop + 10, { width: 140, align: 'right' });

      doc.moveTo(36, totTop + 26).lineTo(576, totTop + 26).strokeColor('#cbd5e1').stroke();

      // Alcance Líquido destacado
      doc
        .roundedRect(390, totTop + 31, 186, 25, 4)
        .fill('#016098');

      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#ffffff')
        .text('LÍQUIDO A PAGO:', 398, totTop + 38)
        .text(`$ ${fmtPesos(personal.liquidoPago)}`, 480, totTop + 38, { width: 90, align: 'right' });

      const enLetras = numeroALetras(personal.liquidoPago);
      doc
        .font('Helvetica-Bold')
        .fontSize(7.2)
        .fillColor('#334155')
        .text(`SON: ${enLetras} PESOS.-`, 38, totTop + 36, { width: 345 });

      // 6. Pie de firma y certificación
      const footTop = 702;
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#475569')
        .text(
          'Certifico que he recibido de la Corporación Municipal de Desarrollo Social de Antofagasta, a mi entera satisfacción, el saldo líquido indicado en la presente liquidación, sin tener cargo ni cobro posterior alguno que hacer por los conceptos señalados.',
          28,
          footTop,
          { width: 556, align: 'justify' }
        );

      doc
        .font('Helvetica-Oblique')
        .fontSize(6.5)
        .fillColor('#64748b')
        .text(
          `Documento emitido electrónicamente a través del Portal del Funcionario CMDS el ${new Date().toLocaleString('es-CL')}.`,
          28,
          742,
          { width: 556, align: 'center' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function generarPdfCertificadoAntiguedad(
  contratos: LiquidacionPersonal[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      if (!contratos || contratos.length === 0) {
        throw new Error('No existen registros contractuales para generar el certificado.');
      }

      const principal = contratos[0];
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 65, right: 65 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const assetsDir = path.join(__dirname, '../../assets');
      const logoPath = path.join(assetsDir, 'logocmns.png');
      const firmaPath = path.join(assetsDir, 'firma_gcuevas.png');

      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 65, 45, { width: 85 });
        } catch {
          // continuar sin imagen
        }
      }

      const hoy = new Date();
      const dia = hoy.getDate();
      const mesTexto = (MESES_NOMBRES[hoy.getMonth() + 1] || '').toLowerCase();
      const anio = hoy.getFullYear();

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#1e293b')
        .text('CORPORACIÓN MUNICIPAL DE DESARROLLO SOCIAL', 160, 55)
        .font('Helvetica')
        .fontSize(8.5)
        .text('DIRECCIÓN DE RECURSOS HUMANOS', 160, 68)
        .text('ANTOFAGASTA', 160, 80);

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#0f172a')
        .text(`Antofagasta, ${dia} de ${mesTexto} de ${anio}.-`, 65, 130, {
          align: 'right',
        });

      doc
        .font('Helvetica-Bold')
        .fontSize(15)
        .text('CERTIFICADO DE ANTIGÜEDAD', 65, 185, {
          align: 'center',
          underline: true,
        });

      doc.moveDown(2.2);

      // Cuerpo del certificado por cada relación contractual vigente en el último período
      contratos.forEach((c, index) => {
        const calidad = (c.detalleCont || 'CONTRATO').toUpperCase();
        const fechaInicio = c.inicioContrato || c.antiguedad || 'fecha registrada';
        const esIndefinido =
          calidad.includes('INDEFINIDO') ||
          !c.terminoContrato ||
          c.terminoContrato.trim() === '' ||
          c.terminoContrato.trim() === '0';

        const tramoFechas = esIndefinido
          ? `desde el ${fechaInicio} a la fecha`
          : `desde el ${fechaInicio} hasta el ${c.terminoContrato}`;

        const parrafo =
          index === 0
            ? `La Jefe del Departamento de Recursos Humanos de la Corporación Municipal de Desarrollo Social de Antofagasta, certifica que el(la) funcionario(a) Don(ña) ${c.nombreFmt}, Cédula Nacional de Identidad Nº ${c.rutFmt}, presta servicios en esta Corporación en calidad de ${calidad}, ${tramoFechas}, desempeñándose actualmente en ${c.nomUnidad} en el cargo de ${c.descripcionCargo || 'FUNCIONARIO(A)'}, con una jornada de ${c.horas ?? 0} horas cronológicas semanales.`
            : `Asimismo, registra contrato en calidad de ${calidad}, ${tramoFechas}, desempeñándose en ${c.nomUnidad} en el cargo de ${c.descripcionCargo || 'FUNCIONARIO(A)'}, con una jornada de ${c.horas ?? 0} horas cronológicas semanales.`;

        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#0f172a')
          .text(parrafo, {
            align: 'justify',
            lineGap: 5,
          });

        doc.moveDown(1.2);
      });

      doc
        .font('Helvetica')
        .fontSize(11)
        .text(
          'Se extiende el presente certificado a petición del(la) interesado(a), para los fines que estime convenientes, sin ulterior responsabilidad para esta Corporación.',
          {
            align: 'justify',
            lineGap: 5,
          }
        );

      // Firma Oficial RRHH
      const firmaTop = 470;
      if (fs.existsSync(firmaPath)) {
        try {
          doc.image(firmaPath, 215, firmaTop, { width: 180 });
        } catch {
          // continuar sin imagen
        }
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0f172a')
        .text('JEFE DEPARTAMENTO DE RECURSOS HUMANOS', 65, firmaTop + 115, {
          align: 'center',
        })
        .text('CORPORACIÓN MUNICIPAL DE DESARROLLO SOCIAL DE ANTOFAGASTA', 65, firmaTop + 130, {
          align: 'center',
        });

      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor('#64748b')
        .text(
          `Documento emitido electrónicamente a través del Portal del Funcionario CMDS el ${hoy.toLocaleString('es-CL')}.`,
          65,
          700,
          { align: 'center' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
