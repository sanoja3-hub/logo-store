// Importa un catálogo en Excel (.xlsx) o CSV: reconoce las columnas por su encabezado y toma las fotos
// incrustadas en cada fila.

import {
  interpretarBloque,
  leerCodigo,
  leerColores,
  leerForma,
  leerMinimo,
  leerTallas,
  type DatosLeidos,
} from '../core/interpretar';
import { aCentavos } from '../core/dinero';
import type { Producto } from '../core/modelo';
import { armarProducto } from './armar';
import { normalizarFoto, type FotoNormalizada } from './imagenes';
import type { Progreso, ResultadoImportacion } from './tipos';
import { leerXlsx, type Hoja } from './xlsx';

type Campo = 'codigo' | 'nombre' | 'descripcion' | 'precio' | 'tallas' | 'colores' | 'categoria' | 'minimo' | 'foto';

// El orden importa: se prueba de arriba abajo y cada columna toma el primer campo libre que reconoce.
const ENCABEZADOS: [Campo, RegExp][] = [
  ['tallas', /talla|size/i],
  ['colores', /colou?r/i],
  ['minimo', /m[ií]nimo|\bmin\b|moq/i],
  ['precio', /precio|mayor|costo|valor|p\.?v\.?p|\busd\b|\$|price/i],
  ['foto', /foto|imagen|img|picture|image/i],
  ['categoria', /categor|tipo|l[ií]nea|familia/i],
  ['codigo', /c[oó]d|\bref|sku|modelo|item|\bcode\b/i],
  ['descripcion', /descrip|detalle|caracter|especific|composici|tela|material/i],
  ['nombre', /nombre|producto|art[ií]culo|prenda|t[ií]tulo|name/i],
];

type Fila = string[];

function buscarEncabezado(filas: Fila[]): { fila: number; columnas: Partial<Record<Campo, number>> } | null {
  for (let f = 0; f < Math.min(filas.length, 20); f++) {
    const columnas: Partial<Record<Campo, number>> = {};
    filas[f].forEach((valor, col) => {
      const v = valor.trim();
      if (!v || v.length > 40) return;
      for (const [campo, re] of ENCABEZADOS) {
        if (columnas[campo] === undefined && re.test(v)) {
          columnas[campo] = col;
          break;
        }
      }
    });
    const n = Object.keys(columnas).length;
    if (n >= 2 && (columnas.codigo !== undefined || columnas.nombre !== undefined || columnas.descripcion !== undefined)) {
      return { fila: f, columnas };
    }
  }
  return null;
}

function datosDeFila(fila: Fila, c: Partial<Record<Campo, number>>, valoresCrudos: unknown[] = []): DatosLeidos {
  const val = (campo: Campo) => (c[campo] !== undefined ? (fila[c[campo]!] ?? '').trim() : '');
  const desc = val('descripcion');
  let nombre = val('nombre');
  let descripcion = desc;
  if (!nombre && desc) {
    // Sin columna de nombre: la primera frase de la descripción hace de nombre.
    const corte = desc.search(/[.\n]/);
    nombre = corte > 3 && corte < 80 ? desc.slice(0, corte).trim() : desc.length <= 60 ? desc : '';
    descripcion = corte > 3 && corte < 80 ? desc.slice(corte + 1).trim() : desc.length <= 60 ? '' : desc;
  }
  const todo = fila.join(' \n');
  const crudoPrecio = c.precio !== undefined ? valoresCrudos[c.precio] : undefined;
  const codigoCelda = val('codigo');
  return {
    codigo: codigoCelda ? codigoCelda.toUpperCase() : leerCodigo(todo),
    nombre: nombre || null,
    descripcion,
    precioCentavos: typeof crudoPrecio === 'number' ? aCentavos(crudoPrecio) : aCentavos(val('precio')),
    tallas: val('tallas') ? leerTallas(val('tallas')) ?? leerTallas(`tallas ${val('tallas')}`) : null,
    colores: leerColores(val('colores') || `${nombre} ${descripcion}`),
    forma: leerForma(`${val('categoria')} ${nombre} ${descripcion}`),
    minimo: val('minimo') ? Number(val('minimo').replace(/\D/g, '')) || leerMinimo(val('minimo')) : null,
  };
}

async function importarHoja(hoja: Hoja, archivo: string, avisos: string[]): Promise<Producto[]> {
  const { filas, numeros } = hoja;
  const enc = buscarEncabezado(filas);
  const filasDatos: number[] = [];
  if (enc) {
    const { columnas } = enc;
    const clave = [columnas.codigo, columnas.nombre, columnas.descripcion].filter((x) => x !== undefined) as number[];
    for (let r = enc.fila + 1; r < filas.length; r++) {
      if (clave.some((col) => (filas[r][col] ?? '').trim())) filasDatos.push(r);
    }
  } else {
    // Sin encabezados: cada fila con algo que parezca un código es un artículo.
    filas.forEach((f, r) => {
      if (leerCodigo(f.join(' '))) filasDatos.push(r);
    });
    if (filasDatos.length) avisos.push(`Hoja «${hoja.nombre}»: no tiene encabezados reconocibles; se leyó fila por fila.`);
  }

  // Cada foto va a la fila de datos que cubre (o la más cercana, hasta 2 filas de distancia).
  const fotosPorFila = new Map<number, { datos: Uint8Array; tipo: string }>();
  for (const a of hoja.imagenes) {
    let mejor = -1;
    let dMejor = Infinity;
    for (const r of filasDatos) {
      const d = r >= a.desde && r <= a.hasta ? 0 : Math.min(Math.abs(r - a.desde), Math.abs(r - a.hasta));
      if (d < dMejor) {
        dMejor = d;
        mejor = r;
      }
    }
    if (mejor >= 0 && dMejor <= 2 && !fotosPorFila.has(mejor)) fotosPorFila.set(mejor, a);
  }

  const productos: Producto[] = [];
  for (const r of filasDatos) {
    const datos = enc ? datosDeFila(filas[r], enc.columnas, numeros[r]) : interpretarBloque(filas[r].filter(Boolean));
    let foto: FotoNormalizada | null = null;
    const img = fotosPorFila.get(r);
    if (img) {
      try {
        foto = await normalizarFoto(new Blob([img.datos as BlobPart], { type: img.tipo }));
      } catch {
        // Imagen dañada o en un formato que el navegador no abre (por ejemplo EMF): queda sin foto y con aviso.
      }
    }
    productos.push(armarProducto(datos, foto, `${archivo} · hoja «${hoja.nombre}», fila ${r + 1}`));
  }
  return productos;
}

export async function importarExcel(archivo: File, progreso?: Progreso): Promise<ResultadoImportacion> {
  const avisos: string[] = [];
  if (/\.xls$/i.test(archivo.name)) {
    throw new Error('El formato .xls antiguo no se puede leer. Ábrelo en Excel y guárdalo como .xlsx.');
  }
  if (/\.csv$/i.test(archivo.name)) return importarCsv(archivo);

  progreso?.('Abriendo el libro de Excel', 0.05);
  const hojas = (await leerXlsx(await archivo.arrayBuffer())).filter((h) => h.filas.length > 0);
  const productos: Producto[] = [];
  for (let i = 0; i < hojas.length; i++) {
    progreso?.(`Leyendo la hoja «${hojas[i].nombre}»`, 0.1 + (0.9 * i) / hojas.length);
    productos.push(...(await importarHoja(hojas[i], archivo.name, avisos)));
  }
  if (productos.length === 0) {
    avisos.push('No se encontraron artículos. Revisa que la hoja tenga columnas como «Código», «Descripción» y «Precio».');
  }
  return { productos, avisos };
}

/** Lector de CSV sencillo (comillas, comas o punto y coma). */
export function leerCsv(texto: string): string[][] {
  const sep = (texto.split('\n')[0].match(/;/g)?.length ?? 0) > (texto.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) {
      fila.push(campo);
      campo = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += ch;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((c) => c.trim()));
}

async function importarCsv(archivo: File): Promise<ResultadoImportacion> {
  const filas = leerCsv(await archivo.text());
  const enc = buscarEncabezado(filas);
  if (!enc) return { productos: [], avisos: ['El CSV no tiene encabezados reconocibles (Código, Descripción, Precio…).'] };
  const productos = filas
    .slice(enc.fila + 1)
    .map((f, i) => armarProducto(datosDeFila(f, enc.columnas), null, `${archivo.name} · fila ${enc.fila + i + 2}`));
  return { productos, avisos: ['Los CSV no llevan fotos: agrégalas en la revisión.'] };
}
