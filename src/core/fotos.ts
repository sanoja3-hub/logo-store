// Fotos del catálogo: cómo se reconocen por el nombre del archivo y cómo se guardan como archivos sueltos.
//
// Las fotos nuevas se cargan nombradas con el código del artículo:
//   2800.jpg            frente (la foto principal)
//   2800-espalda.jpg    espalda (la otra cara de «Foto 3D»)
//   2800-2.jpg          detalle número 2 (bolsillos, cierres, suela…)
//   2800-color-06.jpg   la prenda en el color de código 06 (o del color con ese nombre)
// Lo que no se reconoce no se asigna: se informa con su motivo.

import type { Catalogo, Producto } from './modelo';

export type RolFoto = 'frente' | 'espalda' | 'detalle' | 'color';

export interface FotoReconocida {
  archivo: string;
  productoId: string;
  rol: RolFoto;
  /** Número del detalle (para ordenar) o 0. */
  orden: number;
  /** Nombre del color, cuando el rol es «color». */
  color?: string;
}

export interface FotoSinAsignar {
  archivo: string;
  motivo: string;
}

const EXTENSIONES = /\.(jpe?g|png|webp|avif|gif|bmp)$/i;
const PALABRAS_FRENTE = new Set(['frente', 'front', 'delante', 'principal']);
const PALABRAS_ESPALDA = new Set(['espalda', 'back', 'atras', 'trasera', 'detras']);

const alfanumerico = (c: string) => /[a-z0-9]/i.test(c);

/** Código comparable: sin mayúsculas, espacios, guiones ni puntos. */
export function normalizarCodigo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Si `base` empieza por `codigo` (comparando sin separadores) devuelve lo que sobra; si no, null.
 * El código debe terminar en un separador o al final, para que «2800» no tome «28001.jpg».
 */
function restoTrasCodigo(base: string, codigo: string): string | null {
  let i = 0;
  let n = 0;
  while (i < base.length && n < codigo.length) {
    const c = base[i];
    if (alfanumerico(c)) {
      if (normalizarCodigo(c) !== codigo[n]) return null;
      n++;
    }
    i++;
  }
  if (n < codigo.length) return null;
  const resto = base.slice(i);
  if (resto && alfanumerico(resto[0])) return null;
  return resto;
}

/** Asigna cada archivo de foto a su artículo según el nombre. No toca los productos. */
export function reconocerFotos(
  archivos: string[],
  productos: Pick<Producto, 'id' | 'codigo' | 'colores'>[],
): { asignadas: FotoReconocida[]; sinAsignar: FotoSinAsignar[] } {
  const asignadas: FotoReconocida[] = [];
  const sinAsignar: FotoSinAsignar[] = [];
  // Los códigos más largos primero, para que «160204» gane a «1602».
  const codigos = [...new Set(productos.map((p) => normalizarCodigo(p.codigo)).filter(Boolean))].sort((a, b) => b.length - a.length);
  const ocupadas = new Set<string>();

  const sinExtension = (a: string) => a.replace(/^.*[\\/]/, '').replace(EXTENSIONES, '');
  const ordenados = [...archivos].sort((a, b) => sinExtension(a).localeCompare(sinExtension(b), 'es', { numeric: true }));
  for (const archivo of ordenados) {
    if (!EXTENSIONES.test(archivo)) {
      sinAsignar.push({ archivo, motivo: 'No es una imagen (jpg, png o webp).' });
      continue;
    }
    const base = sinExtension(archivo);
    let codigo: string | null = null;
    let resto = '';
    for (const c of codigos) {
      const r = restoTrasCodigo(base, c);
      if (r !== null) {
        codigo = c;
        resto = r;
        break;
      }
    }
    if (!codigo) {
      sinAsignar.push({ archivo, motivo: 'El nombre no empieza por el código de ningún artículo del catálogo.' });
      continue;
    }
    const partes = resto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    let rol: RolFoto;
    let orden = 0;
    let colorBuscado: string | null = null;
    if (partes.length === 0 || (partes.length === 1 && PALABRAS_FRENTE.has(partes[0]))) rol = 'frente';
    else if (partes.length === 1 && PALABRAS_ESPALDA.has(partes[0])) rol = 'espalda';
    else if (partes.length === 1 && /^\d+$/.test(partes[0])) {
      rol = 'detalle';
      orden = Number(partes[0]);
    } else if (partes[0] === 'detalle' && partes.length <= 2 && (partes.length === 1 || /^\d+$/.test(partes[1]))) {
      rol = 'detalle';
      orden = Number(partes[1] ?? 1);
    } else if (partes[0] === 'color' && partes.length >= 2) {
      rol = 'color';
      colorBuscado = partes.slice(1).join('');
    } else {
      sinAsignar.push({ archivo, motivo: `No se entiende «${resto}» después del código (usa -espalda, -2 o -color-06).` });
      continue;
    }

    for (const p of productos.filter((x) => normalizarCodigo(x.codigo) === codigo)) {
      let color: string | undefined;
      if (rol === 'color') {
        const buscado = normalizarCodigo(colorBuscado!);
        const c = p.colores.find((x) => (x.codigo && normalizarCodigo(x.codigo) === buscado) || normalizarCodigo(x.nombre) === buscado);
        if (!c) {
          sinAsignar.push({ archivo, motivo: `El artículo ${p.codigo} no tiene el color «${colorBuscado}».` });
          continue;
        }
        color = c.nombre;
      }
      const clave = `${p.id}|${rol}|${rol === 'detalle' ? orden : (color ?? '')}`;
      if (ocupadas.has(clave)) {
        sinAsignar.push({ archivo, motivo: `Ya hay otra foto de ${rol === 'detalle' ? `detalle ${orden}` : rol} para ${p.codigo}.` });
        continue;
      }
      ocupadas.add(clave);
      asignadas.push({ archivo, productoId: p.id, rol, orden, ...(color ? { color } : {}) });
    }
  }
  return { asignadas, sinAsignar };
}

/** El catálogo sin ninguna foto, para cargar las nuevas desde cero. */
export function quitarFotos(productos: Producto[]): Producto[] {
  return productos.map((p) => ({
    ...p,
    foto: null,
    fotoEspalda: null,
    fotos: [],
    colores: p.colores.map((c) => ({ ...c, foto: null, fotoProducto: null })),
  }));
}

/** Aplica `fn` a cada foto del producto (frente, espalda, detalles y colores) y devuelve el producto nuevo. */
export async function mapearFotos(
  p: Producto,
  fn: (foto: string, nombre: string) => Promise<string | null>,
): Promise<Producto> {
  const base = nombreBase(p);
  const una = (f: string | null | undefined, nombre: string) => (f ? fn(f, nombre) : Promise.resolve(f ?? null));
  const fotos = await Promise.all((p.fotos ?? []).map((f, i) => fn(f, `${base}-${i + 2}`)));
  return {
    ...p,
    foto: await una(p.foto, base),
    fotoEspalda: await una(p.fotoEspalda, `${base}-espalda`),
    fotos: fotos.filter((f): f is string => !!f),
    colores: await Promise.all(
      p.colores.map(async (c) => {
        const nombre = nombreArchivo(c.codigo || c.nombre);
        return {
          ...c,
          foto: await una(c.foto, `${base}-muestra-${nombre}`),
          fotoProducto: await una(c.fotoProducto, `${base}-color-${nombre}`),
        };
      }),
    ),
  };
}

const nombreArchivo = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

/** Nombre de archivo de las fotos de un artículo: su código (o su id si no tiene código). */
export function nombreBase(p: Pick<Producto, 'id' | 'codigo'>): string {
  return nombreArchivo(p.codigo) || nombreArchivo(p.id);
}

export const CARPETA_FOTOS = 'fotos';

export const esDataUrl = (s: string) => s.startsWith('data:');

/** Cuenta las fotos del catálogo, y cuántas van incrustadas en el JSON en vez de como archivo. */
export function contarFotos(cat: Catalogo): { total: number; incrustadas: number } {
  let total = 0;
  let incrustadas = 0;
  for (const p of cat.productos) {
    for (const f of [p.foto, p.fotoEspalda, ...(p.fotos ?? []), ...p.colores.flatMap((c) => [c.foto, c.fotoProducto])]) {
      if (!f) continue;
      total++;
      if (esDataUrl(f)) incrustadas++;
    }
  }
  return { total, incrustadas };
}
