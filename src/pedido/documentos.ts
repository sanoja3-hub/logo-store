// Orden de pedido en PDF y Excel para el asesor: datos del cliente, logo, artículos con foto, tallas y totales.

import { formatoDinero } from '../core/dinero';
import { totalUnidades, type Ajustes, type Cliente, type LineaPedido, type LogoCliente } from '../core/modelo';
import { subtotal, tallasDelPedido, textoLogo, totales } from './orden';

export interface DatosOrden {
  numero: string;
  fecha: Date;
  lineas: LineaPedido[];
  cliente: Cliente;
  logo: LogoCliente | null;
  ajustes: Ajustes;
}

/** Pasa cualquier imagen a JPEG con fondo blanco (o PNG si conserva transparencia), lista para el PDF. */
async function imagenParaDocumento(
  dataUrl: string,
  maxLado: number,
  formato: 'jpeg' | 'png' = 'jpeg',
): Promise<{ url: string; w: number; h: number }> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const k = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = c.getContext('2d')!;
  if (formato === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL(`image/${formato}`, 0.9), w: c.width, h: c.height };
}

const fechaLarga = (f: Date) =>
  f.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' }) +
  ' · ' +
  f.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

export async function ordenPdf(d: DatosOrden): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 14;
  const azul: [number, number, number] = [16, 32, 64];
  const gris: [number, number, number] = [100, 108, 122];
  const linea: [number, number, number] = [222, 226, 232];

  const encabezado = () => {
    pdf.setFillColor(...azul);
    pdf.rect(0, 0, W, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(d.ajustes.empresa.toUpperCase(), M, 13);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(d.ajustes.lema, M, 19);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('ORDEN DE PEDIDO', W - M, 12, { align: 'right' });
    pdf.setFontSize(13);
    pdf.text(d.numero, W - M, 19, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(fechaLarga(d.fecha), W - M, 24.5, { align: 'right' });
    pdf.setTextColor(20, 24, 32);
  };

  const pie = (pagina: number, total: number) => {
    pdf.setDrawColor(...linea);
    pdf.line(M, 285, W - M, 285);
    pdf.setFontSize(7.5);
    pdf.setTextColor(...gris);
    pdf.text(
      'Precios referenciales sujetos a confirmación del asesor. Colores en pantalla y vistas 3D son aproximados.',
      M,
      289,
    );
    pdf.text(`${d.numero} · Página ${pagina} de ${total}`, W - M, 289, { align: 'right' });
    pdf.setTextColor(20, 24, 32);
  };

  encabezado();
  let y = 38;

  // Cliente
  pdf.setFontSize(8);
  pdf.setTextColor(...gris);
  pdf.text('CLIENTE', M, y);
  pdf.setTextColor(20, 24, 32);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(d.cliente.empresa || '—', M, y + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const datos = [
    d.cliente.rif && `RIF: ${d.cliente.rif}`,
    `Contacto: ${d.cliente.contacto || '—'}`,
    `Teléfono: ${d.cliente.telefono || '—'}`,
    d.cliente.correo && `Correo: ${d.cliente.correo}`,
    d.cliente.ciudad && `Entrega: ${d.cliente.ciudad}`,
  ].filter(Boolean) as string[];
  datos.forEach((t, i) => pdf.text(t, M, y + 12 + i * 4.8));

  // Logo del cliente
  const cajaLogo = { x: W - M - 58, y: y - 3, w: 58, h: 34 };
  pdf.setDrawColor(...linea);
  pdf.roundedRect(cajaLogo.x, cajaLogo.y, cajaLogo.w, cajaLogo.h, 2, 2);
  pdf.setFontSize(7);
  pdf.setTextColor(...gris);
  pdf.text('LOGO DEL CLIENTE', cajaLogo.x + 2.5, cajaLogo.y + 4);
  pdf.setTextColor(20, 24, 32);
  if (d.logo) {
    const im = await imagenParaDocumento(d.logo.dataUrl, 800, 'png');
    const maxW = cajaLogo.w - 8;
    const maxH = cajaLogo.h - 12;
    const k = Math.min(maxW / im.w, maxH / im.h);
    pdf.addImage(im.url, 'PNG', cajaLogo.x + (cajaLogo.w - im.w * k) / 2, cajaLogo.y + 6 + (maxH - im.h * k) / 2, im.w * k, im.h * k);
    pdf.setFontSize(6.5);
    pdf.setTextColor(...gris);
    pdf.text(`${d.logo.nombreArchivo} · ${d.logo.ancho}×${d.logo.alto}px`, cajaLogo.x + 2.5, cajaLogo.y + cajaLogo.h - 2);
    pdf.setTextColor(20, 24, 32);
  } else {
    pdf.setFontSize(8);
    pdf.text('No adjuntó logo', cajaLogo.x + cajaLogo.w / 2, cajaLogo.y + cajaLogo.h / 2 + 1, { align: 'center' });
  }

  y = Math.max(y + 14 + datos.length * 4.8, cajaLogo.y + cajaLogo.h) + 6;

  // Artículos
  pdf.setFontSize(8);
  pdf.setTextColor(...gris);
  pdf.text('ARTÍCULOS', M, y);
  pdf.setTextColor(20, 24, 32);
  y += 3;

  for (let i = 0; i < d.lineas.length; i++) {
    const l = d.lineas[i];
    const tallas = Object.keys(l.cantidades);
    const alto = 46;
    if (y + alto > 280) {
      pdf.addPage();
      encabezado();
      y = 38;
    }
    pdf.setDrawColor(...linea);
    pdf.roundedRect(M, y, W - 2 * M, alto, 2, 2);

    // Foto del catálogo y vista 3D
    let x = M + 3;
    for (const src of [l.foto, l.vista3d]) {
      if (!src) continue;
      try {
        const im = await imagenParaDocumento(src, 500);
        const lado = alto - 6;
        const k = Math.min(lado / im.w, lado / im.h);
        pdf.addImage(im.url, 'JPEG', x + (lado - im.w * k) / 2, y + 3 + (lado - im.h * k) / 2, im.w * k, im.h * k);
        x += lado + 2;
      } catch {
        // imagen ilegible: se omite
      }
    }
    const tx = Math.max(x + 2, M + 46);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(`${i + 1}. ${l.nombre || 'Artículo'}`, tx, y + 7, { maxWidth: W - M - tx - 3 });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...gris);
    pdf.text(`Código ${l.codigo || '—'}${l.color ? ` · Color ${l.color.nombre}` : ''}`, tx, y + 12);
    pdf.text(`Logo: ${textoLogo(l)}`, tx, y + 16.5);
    if (l.nota) pdf.text(`Nota: ${l.nota}`, tx, y + 21, { maxWidth: W - M - tx - 3 });
    pdf.setTextColor(20, 24, 32);

    // Tabla de tallas
    const ty = y + 26;
    const anchoT = Math.min(14, (W - M - tx - 34) / Math.max(1, tallas.length));
    pdf.setFillColor(244, 246, 249);
    pdf.rect(tx, ty, anchoT * tallas.length, 12, 'F');
    tallas.forEach((t, k) => {
      pdf.setFontSize(7.5);
      pdf.setTextColor(...gris);
      pdf.text(t, tx + anchoT * k + anchoT / 2, ty + 4.3, { align: 'center' });
      pdf.setTextColor(20, 24, 32);
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', l.cantidades[t] > 0 ? 'bold' : 'normal');
      pdf.text(String(l.cantidades[t] || '–'), tx + anchoT * k + anchoT / 2, ty + 9.8, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
    });
    // Totales de la línea
    pdf.setFontSize(8);
    pdf.setTextColor(...gris);
    pdf.text('Unidades', W - M - 3, ty + 1, { align: 'right' });
    pdf.setTextColor(20, 24, 32);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(String(totalUnidades(l)), W - M - 3, ty + 6.5, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    const st = subtotal(l);
    if (d.ajustes.mostrarPrecios && st !== null && l.precioCentavos !== null) {
      pdf.setFontSize(8);
      pdf.setTextColor(...gris);
      pdf.text(`${formatoDinero(l.precioCentavos, d.ajustes.moneda)} c/u · ${formatoDinero(st, d.ajustes.moneda)}`, W - M - 3, ty + 11, {
        align: 'right',
      });
      pdf.setTextColor(20, 24, 32);
    }
    y += alto + 4;
  }

  // Resumen
  const t = totales(d.lineas);
  if (y + 30 > 280) {
    pdf.addPage();
    encabezado();
    y = 38;
  }
  pdf.setFillColor(...azul);
  pdf.roundedRect(W - M - 80, y, 80, d.ajustes.mostrarPrecios && t.montoCentavos > 0 ? 22 : 13, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.text('Total de unidades', W - M - 76, y + 8);
  pdf.setFont('helvetica', 'bold');
  pdf.text(String(t.unidades), W - M - 4, y + 8, { align: 'right' });
  if (d.ajustes.mostrarPrecios && t.montoCentavos > 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.text(t.completo ? 'Monto referencial' : 'Monto (artículos con precio)', W - M - 76, y + 16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(formatoDinero(t.montoCentavos, d.ajustes.moneda), W - M - 4, y + 16, { align: 'right' });
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(20, 24, 32);
  if (d.cliente.notas) {
    pdf.setFontSize(8);
    pdf.setTextColor(...gris);
    pdf.text('NOTAS DEL CLIENTE', M, y + 4);
    pdf.setTextColor(20, 24, 32);
    pdf.setFontSize(9);
    pdf.text(d.cliente.notas, M, y + 9, { maxWidth: W - 2 * M - 88 });
  }

  const paginas = pdf.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    pdf.setPage(p);
    pie(p, paginas);
  }
  return pdf.output('blob');
}

export async function ordenExcel(d: DatosOrden): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = d.ajustes.empresa;
  const hoja = libro.addWorksheet('Pedido', { views: [{ showGridLines: false }] });
  const tallas = tallasDelPedido(d.lineas);
  const cols = ['Foto', 'Código', 'Artículo', 'Color', 'Logo', ...tallas, 'Unidades', 'Precio', 'Subtotal', 'Nota'];

  hoja.mergeCells(1, 1, 1, 6);
  hoja.getCell(1, 1).value = `${d.ajustes.empresa} · Orden de pedido ${d.numero}`;
  hoja.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF102040' } };
  const info: [string, string][] = [
    ['Fecha', fechaLarga(d.fecha)],
    ['Empresa', d.cliente.empresa],
    ['RIF', d.cliente.rif],
    ['Contacto', d.cliente.contacto],
    ['Teléfono', d.cliente.telefono],
    ['Correo', d.cliente.correo],
    ['Entrega', d.cliente.ciudad],
    ['Notas', d.cliente.notas],
  ];
  info.forEach(([k, v], i) => {
    hoja.getCell(3 + i, 1).value = k;
    hoja.getCell(3 + i, 1).font = { color: { argb: 'FF646C7A' } };
    hoja.getCell(3 + i, 2).value = v || '—';
    hoja.mergeCells(3 + i, 2, 3 + i, 4);
  });
  if (d.logo) {
    const im = await imagenParaDocumento(d.logo.dataUrl, 600, 'png');
    const id = libro.addImage({ base64: im.url, extension: 'png' });
    const k = Math.min(220 / im.w, 120 / im.h);
    hoja.addImage(id, { tl: { col: 5, row: 2 }, ext: { width: im.w * k, height: im.h * k } });
    hoja.getCell(2, 6).value = 'Logo del cliente';
  }

  const filaEnc = 13;
  cols.forEach((c, i) => {
    const celda = hoja.getCell(filaEnc, i + 1);
    celda.value = c;
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102040' } };
    celda.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  hoja.getRow(filaEnc).height = 22;

  for (let i = 0; i < d.lineas.length; i++) {
    const l = d.lineas[i];
    const r = filaEnc + 1 + i;
    const fila = hoja.getRow(r);
    fila.height = 70;
    const st = subtotal(l);
    const valores: (string | number)[] = [
      '',
      l.codigo,
      l.nombre,
      l.color?.nombre ?? '',
      textoLogo(l),
      ...tallas.map((t) => l.cantidades[t] ?? ''),
      totalUnidades(l),
      l.precioCentavos !== null && d.ajustes.mostrarPrecios ? l.precioCentavos / 100 : '',
      st !== null && d.ajustes.mostrarPrecios ? st / 100 : '',
      l.nota,
    ];
    valores.forEach((v, k) => {
      const c = fila.getCell(k + 1);
      c.value = v === 0 ? '' : v;
      c.alignment = { vertical: 'middle', horizontal: k >= 5 && k < 5 + tallas.length + 1 ? 'center' : 'left', wrapText: true };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFDEE2E8' } } };
    });
    fila.getCell(cols.length - 2).numFmt = '#,##0.00';
    fila.getCell(cols.length - 1).numFmt = '#,##0.00';
    if (l.foto) {
      try {
        const im = await imagenParaDocumento(l.foto, 240);
        const id = libro.addImage({ base64: im.url, extension: 'jpeg' });
        const k = Math.min(84 / im.w, 84 / im.h);
        hoja.addImage(id, { tl: { col: 0.1, row: r - 1 + 0.05 }, ext: { width: im.w * k, height: im.h * k } });
      } catch {
        // sin foto
      }
    }
  }
  const t = totales(d.lineas);
  const rTotal = filaEnc + d.lineas.length + 2;
  hoja.getCell(rTotal, 3).value = 'Total';
  hoja.getCell(rTotal, 3).font = { bold: true };
  hoja.getCell(rTotal, 6 + tallas.length).value = t.unidades;
  hoja.getCell(rTotal, 6 + tallas.length).font = { bold: true };
  if (d.ajustes.mostrarPrecios && t.montoCentavos > 0) {
    hoja.getCell(rTotal, 8 + tallas.length).value = t.montoCentavos / 100;
    hoja.getCell(rTotal, 8 + tallas.length).numFmt = '#,##0.00';
    hoja.getCell(rTotal, 8 + tallas.length).font = { bold: true };
  }
  hoja.columns.forEach((c, i) => {
    c.width = i === 0 ? 14 : i === 2 ? 34 : i === 4 ? 26 : i >= 5 && i < 5 + tallas.length ? 7 : i === cols.length - 1 ? 30 : 13;
  });
  const buf = await libro.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function nombreArchivo(d: Pick<DatosOrden, 'numero' | 'cliente'>, ext: string): string {
  const empresa = (d.cliente.empresa || 'cliente')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return `${d.numero}_${empresa}.${ext}`;
}

