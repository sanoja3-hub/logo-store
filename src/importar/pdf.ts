// Importa un catálogo en PDF: busca las fotos de cada página con su posición, junta el texto cercano a cada
// foto y arma un producto por foto. Funciona con catálogos de varios artículos por página.

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { interpretarBloque } from '../core/interpretar';
import type { Producto } from '../core/modelo';
import { armarProducto } from './armar';
import { normalizarDesdeLienzo } from './imagenes';
import type { Progreso, ResultadoImportacion } from './tipos';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const ESCALA = 2;

interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Segmento extends Caja {
  texto: string;
  alto: number;
}

type Matriz = [number, number, number, number, number, number];

const multiplicar = (m: Matriz, n: Matriz): Matriz => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const area = (c: Caja) => Math.max(0, c.x1 - c.x0) * Math.max(0, c.y1 - c.y0);
const interseccion = (a: Caja, b: Caja) =>
  area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
const distancia = (a: Caja, b: Caja) => {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.hypot(dx, dy);
};

/** Cajas (en píxeles del lienzo) donde la página pinta imágenes. */
async function cajasDeImagenes(page: pdfjs.PDFPageProxy, viewport: pdfjs.PageViewport): Promise<Caja[]> {
  const ops = await page.getOperatorList();
  const OPS = pdfjs.OPS;
  let ctm: Matriz = [1, 0, 0, 1, 0, 0];
  const pila: Matriz[] = [];
  const cajas: Caja[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[];
    if (fn === OPS.save) pila.push(ctm);
    else if (fn === OPS.restore) ctm = pila.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = multiplicar(ctm, args as Matriz);
    else if (fn === OPS.paintFormXObjectBegin) {
      pila.push(ctm);
      const m = args?.[0] as Matriz | null;
      if (Array.isArray(m) && m.length === 6) ctm = multiplicar(ctm, m);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = pila.pop() ?? ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const esquinas = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([u, v]) => {
        const x = ctm[0] * u + ctm[2] * v + ctm[4];
        const y = ctm[1] * u + ctm[3] * v + ctm[5];
        return viewport.convertToViewportPoint(x, y);
      });
      const xs = esquinas.map((p) => p[0]);
      const ys = esquinas.map((p) => p[1]);
      cajas.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    }
  }
  const pagina = viewport.width * viewport.height;
  const minimo = (50 * ESCALA) ** 2;
  // Fuera: íconos pequeños, fondos de página completa y cajas fuera de la página.
  const utiles = cajas
    .map((c) => ({
      x0: Math.max(0, c.x0),
      y0: Math.max(0, c.y0),
      x1: Math.min(viewport.width, c.x1),
      y1: Math.min(viewport.height, c.y1),
    }))
    .filter((c) => area(c) >= minimo && area(c) < pagina * 0.8);

  // Une imágenes superpuestas (por ejemplo, una foto con una máscara encima).
  const unidas: Caja[] = [];
  for (const c of utiles.sort((a, b) => area(b) - area(a))) {
    const dentro = unidas.find((u) => interseccion(u, c) > area(c) * 0.5);
    if (dentro) {
      dentro.x0 = Math.min(dentro.x0, c.x0);
      dentro.y0 = Math.min(dentro.y0, c.y0);
      dentro.x1 = Math.max(dentro.x1, c.x1);
      dentro.y1 = Math.max(dentro.y1, c.y1);
    } else unidas.push({ ...c });
  }
  return unidas;
}

interface ItemTexto extends Caja {
  str: string;
  alto: number;
}

/** Junta los trozos de texto en segmentos: misma línea y cerca uno del otro (no mezcla columnas). */
async function segmentosDeTexto(page: pdfjs.PDFPageProxy, viewport: pdfjs.PageViewport): Promise<Segmento[]> {
  const contenido = await page.getTextContent();
  const items: ItemTexto[] = [];
  for (const it of contenido.items) {
    if (!('str' in it) || !it.str.trim()) continue;
    const [, , c, d, e, f] = it.transform as number[];
    const altoPdf = it.height || Math.hypot(c, d) || 10;
    const [xa, ya] = viewport.convertToViewportPoint(e, f);
    const [xb, yb] = viewport.convertToViewportPoint(e + it.width, f + altoPdf);
    items.push({
      str: it.str,
      x0: Math.min(xa, xb),
      x1: Math.max(xa, xb),
      y0: Math.min(ya, yb),
      y1: Math.max(ya, yb),
      alto: Math.abs(yb - ya) || altoPdf * ESCALA,
    });
  }
  items.sort((a, b) => a.y1 - b.y1 || a.x0 - b.x0);

  const segmentos: Segmento[] = [];
  for (const it of items) {
    const seg = segmentos.find(
      (s) =>
        Math.abs(s.y1 - it.y1) < Math.min(s.alto, it.alto) * 0.5 &&
        it.x0 - s.x1 < Math.max(s.alto, it.alto) * 1.6 &&
        it.x0 >= s.x0 - 2,
    );
    if (seg) {
      const hueco = it.x0 - seg.x1;
      seg.texto += (hueco > seg.alto * 0.18 && !seg.texto.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '') + it.str;
      seg.x1 = Math.max(seg.x1, it.x1);
      seg.y0 = Math.min(seg.y0, it.y0);
      seg.y1 = Math.max(seg.y1, it.y1);
    } else {
      segmentos.push({ texto: it.str, x0: it.x0, x1: it.x1, y0: it.y0, y1: it.y1, alto: it.alto });
    }
  }
  return segmentos
    .map((s) => ({ ...s, texto: s.texto.replace(/\s+/g, ' ').trim() }))
    .filter((s) => s.texto && !/^\d{1,3}$/.test(s.texto)); // fuera números de página
}

function recortar(lienzo: HTMLCanvasElement, c: Caja): HTMLCanvasElement {
  const w = Math.max(1, Math.round(c.x1 - c.x0));
  const h = Math.max(1, Math.round(c.y1 - c.y0));
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(lienzo, Math.round(c.x0), Math.round(c.y0), w, h, 0, 0, w, h);
  return out;
}

export async function importarPdf(archivo: File, progreso?: Progreso): Promise<ResultadoImportacion> {
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const tarea = pdfjs.getDocument({ data: datos });
  const doc = await tarea.promise;
  const productos: Producto[] = [];
  const avisos: string[] = [];

  // Primera pasada: texto de cada página, para quitar encabezados y pies que se repiten.
  const textos: Segmento[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    progreso?.(`Leyendo el texto de la página ${n} de ${doc.numPages}`, n / doc.numPages / 3);
    const page = await doc.getPage(n);
    textos.push(await segmentosDeTexto(page, page.getViewport({ scale: ESCALA })));
  }
  const repetidos = new Set<string>();
  if (doc.numPages >= 2) {
    const cuenta = new Map<string, number>();
    for (const segs of textos) for (const t of new Set(segs.map((s) => s.texto))) cuenta.set(t, (cuenta.get(t) ?? 0) + 1);
    const minimo = doc.numPages === 2 ? 2 : Math.max(3, doc.numPages * 0.5);
    for (const [t, c] of cuenta) if (c >= minimo) repetidos.add(t);
  }

  let fotosSinTexto = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    progreso?.(`Buscando artículos en la página ${n} de ${doc.numPages}`, 1 / 3 + (n / doc.numPages) * (2 / 3));
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: ESCALA });
    const cajas = await cajasDeImagenes(page, viewport);
    const segmentos = textos[n - 1].filter((s) => !repetidos.has(s.texto));

    if (segmentos.length === 0 && cajas.length === 0) continue;
    if (segmentos.length === 0) {
      avisos.push(`Página ${n}: no tiene texto seleccionable (parece escaneada); no se pudieron leer sus artículos.`);
      continue;
    }

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.ceil(viewport.width);
    lienzo.height = Math.ceil(viewport.height);
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    await page.render({ canvas: lienzo, canvasContext: ctx, viewport }).promise;

    if (cajas.length === 0) {
      // Página sin fotos: si trae un artículo, se toma la página completa como imagen de referencia.
      const datos = interpretarBloque(segmentos.map((s) => s.texto));
      if (datos.codigo || datos.precioCentavos) {
        const p = armarProducto(datos, normalizarDesdeLienzo(lienzo, lienzo.width, lienzo.height), `${archivo.name} · pág. ${n}`);
        p.avisos.push('La página no tiene fotos separadas: la imagen es la página completa.');
        productos.push(p);
      }
      continue;
    }

    // Cada línea de texto va con la foto más cercana; el texto muy lejano (títulos de sección) se ignora.
    const grupos = cajas.map(() => [] as Segmento[]);
    for (const s of segmentos) {
      let mejor = -1;
      let dMejor = Infinity;
      cajas.forEach((c, i) => {
        const d = distancia(s, c);
        if (d < dMejor) {
          dMejor = d;
          mejor = i;
        }
      });
      const c = cajas[mejor];
      if (dMejor <= Math.max(c.x1 - c.x0, c.y1 - c.y0) * 0.6) grupos[mejor].push(s);
    }

    const orden = cajas
      .map((c, i) => ({ c, i }))
      .sort((a, b) => (Math.abs(a.c.y0 - b.c.y0) > 40 ? a.c.y0 - b.c.y0 : a.c.x0 - b.c.x0));
    for (const { c, i } of orden) {
      const segs = grupos[i].sort((a, b) => (Math.abs(a.y0 - b.y0) > a.alto * 0.5 ? a.y0 - b.y0 : a.x0 - b.x0));
      if (segs.length === 0) {
        fotosSinTexto++;
        continue;
      }
      const datos = interpretarBloque(segs.map((s) => s.texto));
      const recorte = recortar(lienzo, c);
      const foto = normalizarDesdeLienzo(recorte, recorte.width, recorte.height);
      productos.push(armarProducto(datos, foto, `${archivo.name} · pág. ${n}`));
    }
    page.cleanup();
  }
  if (fotosSinTexto > 0) {
    avisos.push(`${fotosSinTexto} imagen(es) sin texto cerca se descartaron (logos o fotos decorativas).`);
  }
  await tarea.destroy();
  return { productos, avisos };
}
