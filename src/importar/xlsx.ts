// Lector propio de .xlsx (un .xlsx es un zip con XML): celdas, hojas y fotos con su posición.
// Se hace a mano porque las librerías comunes fallan con archivos de algunos generadores y no leen
// las fotos «dentro de la celda» de Excel 365.

import JSZip from 'jszip';

export interface ImagenHoja {
  /** Fila (base 0) donde empieza y termina la foto. */
  desde: number;
  hasta: number;
  col: number;
  datos: Uint8Array;
  tipo: string;
}

export interface Hoja {
  nombre: string;
  filas: string[][];
  /** Valores numéricos tal cual (para precios); null si la celda no es numérica. */
  numeros: (number | null)[][];
  imagenes: ImagenHoja[];
}

const xml = (texto: string) => new DOMParser().parseFromString(texto, 'application/xml');
const hijos = (n: Document | Element, nombre: string) => Array.from(n.getElementsByTagNameNS('*', nombre));
const primero = (n: Document | Element, nombre: string) => n.getElementsByTagNameNS('*', nombre)[0] as Element | undefined;
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function resolver(base: string, destino: string): string {
  if (destino.startsWith('/')) return destino.slice(1);
  const partes = base.split('/').slice(0, -1);
  for (const p of destino.split('/')) {
    if (p === '..') partes.pop();
    else if (p !== '.') partes.push(p);
  }
  return partes.join('/');
}

async function leerRels(zip: JSZip, ruta: string): Promise<Map<string, string>> {
  const partes = ruta.split('/');
  const nombre = partes.pop()!;
  const rutaRels = [...partes, '_rels', `${nombre}.rels`].join('/');
  const archivo = zip.file(rutaRels);
  const m = new Map<string, string>();
  if (!archivo) return m;
  for (const r of hijos(xml(await archivo.async('text')), 'Relationship')) {
    m.set(r.getAttribute('Id') ?? '', resolver(ruta, r.getAttribute('Target') ?? ''));
  }
  return m;
}

function columnaDe(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const TIPOS: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
const tipoDe = (ruta: string) => TIPOS[ruta.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

/** Fotos «dentro de la celda» (Excel 365): índice de valor enriquecido → archivo de imagen. */
async function imagenesEnCelda(zip: JSZip): Promise<string[]> {
  const rv = zip.file('xl/richData/rdrichvalue.xml');
  const rel = zip.file('xl/richData/richValueRel.xml');
  if (!rv || !rel) return [];
  const rels = await leerRels(zip, 'xl/richData/richValueRel.xml');
  const ids = hijos(xml(await rel.async('text')), 'rel').map((r) => rels.get(r.getAttributeNS(R_NS, 'id') ?? r.getAttribute('r:id') ?? '') ?? '');
  return hijos(xml(await rv.async('text')), 'rv').map((v) => {
    const idx = Number(primero(v, 'v')?.textContent ?? -1);
    return ids[idx] ?? '';
  });
}

export async function leerXlsx(datos: ArrayBuffer): Promise<Hoja[]> {
  const zip = await JSZip.loadAsync(datos);
  const libro = zip.file('xl/workbook.xml');
  if (!libro) throw new Error('El archivo no es un Excel válido (.xlsx).');

  const compartidas: string[] = [];
  const ss = zip.file('xl/sharedStrings.xml');
  if (ss) {
    for (const si of hijos(xml(await ss.async('text')), 'si')) {
      compartidas.push(hijos(si, 't').map((t) => t.textContent ?? '').join(''));
    }
  }
  const enCelda = await imagenesEnCelda(zip);
  const relsLibro = await leerRels(zip, 'xl/workbook.xml');
  const hojas: Hoja[] = [];

  for (const h of hijos(xml(await libro.async('text')), 'sheet')) {
    if (h.getAttribute('state') === 'hidden') continue;
    const rid = h.getAttributeNS(R_NS, 'id') ?? h.getAttribute('r:id') ?? '';
    const ruta = relsLibro.get(rid);
    const archivo = ruta && zip.file(ruta);
    if (!ruta || !archivo) continue;
    const doc = xml(await archivo.async('text'));
    const filas: string[][] = [];
    const numeros: (number | null)[][] = [];
    const imagenes: ImagenHoja[] = [];
    const pendientes: { fila: number; col: number; ruta: string }[] = [];

    for (const fila of hijos(doc, 'row')) {
      const r = Number(fila.getAttribute('r')) - 1;
      for (const c of hijos(fila, 'c')) {
        const ref = c.getAttribute('r') ?? '';
        const col = columnaDe(ref);
        const tipo = c.getAttribute('t');
        const v = primero(c, 'v')?.textContent ?? '';
        let texto = '';
        let num: number | null = null;
        if (tipo === 's') texto = compartidas[Number(v)] ?? '';
        else if (tipo === 'inlineStr') texto = hijos(c, 't').map((t) => t.textContent ?? '').join('');
        else if (tipo === 'str' || tipo === 'e') texto = v;
        else if (tipo === 'b') texto = v === '1' ? 'VERDADERO' : 'FALSO';
        else if (v !== '') {
          num = Number(v);
          texto = Number.isFinite(num) ? String(Math.round(num * 10000) / 10000) : v;
        }
        const vm = c.getAttribute('vm');
        if (vm && enCelda[Number(vm) - 1]) pendientes.push({ fila: r, col, ruta: enCelda[Number(vm) - 1] });
        (filas[r] ??= [])[col] = texto;
        (numeros[r] ??= [])[col] = num;
      }
    }

    // Fotos flotantes: dibujo de la hoja con anclas (desde/hasta fila y columna).
    const relsHoja = await leerRels(zip, ruta);
    for (const dib of hijos(doc, 'drawing')) {
      const rutaDib = relsHoja.get(dib.getAttributeNS(R_NS, 'id') ?? dib.getAttribute('r:id') ?? '');
      const archDib = rutaDib && zip.file(rutaDib);
      if (!rutaDib || !archDib) continue;
      const relsDib = await leerRels(zip, rutaDib);
      const dDoc = xml(await archDib.async('text'));
      const anclas = [...hijos(dDoc, 'twoCellAnchor'), ...hijos(dDoc, 'oneCellAnchor'), ...hijos(dDoc, 'absoluteAnchor')];
      for (const a of anclas) {
        const blip = primero(a, 'blip');
        const emb = blip?.getAttributeNS(R_NS, 'embed') ?? blip?.getAttribute('r:embed');
        const rutaImg = emb ? relsDib.get(emb) : undefined;
        const desde = primero(a, 'from');
        if (!rutaImg || !desde) continue;
        const hasta = primero(a, 'to');
        const filaDesde = Number(primero(desde, 'row')?.textContent ?? 0);
        const filaHasta = hasta ? Number(primero(hasta, 'row')?.textContent ?? filaDesde) : filaDesde;
        pendientes.push({ fila: filaDesde, col: Number(primero(desde, 'col')?.textContent ?? 0), ruta: rutaImg, ...{ hasta: filaHasta } });
      }
    }
    for (const p of pendientes as (typeof pendientes[number] & { hasta?: number })[]) {
      const img = zip.file(p.ruta);
      if (!img) continue;
      imagenes.push({ desde: p.fila, hasta: p.hasta ?? p.fila, col: p.col, datos: await img.async('uint8array'), tipo: tipoDe(p.ruta) });
    }

    const ancho = Math.max(0, ...filas.map((f) => f?.length ?? 0));
    for (let i = 0; i < filas.length; i++) {
      filas[i] = Array.from({ length: ancho }, (_, k) => filas[i]?.[k] ?? '');
      numeros[i] = Array.from({ length: ancho }, (_, k) => numeros[i]?.[k] ?? null);
    }
    hojas.push({ nombre: h.getAttribute('name') ?? `Hoja ${hojas.length + 1}`, filas, numeros, imagenes });
  }
  return hojas;
}
