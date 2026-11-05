// Reglas para leer los datos de un artículo a partir del texto del catálogo (PDF o Excel).
// No se inventa nada: lo que no aparece queda vacío y se avisa.

import { aCentavos } from './dinero';
import type { ColorProducto, Forma3D } from './modelo';

export const TALLAS_LETRA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
export const TALLAS_SUPERIOR = ['S', 'M', 'L', 'XL', 'XXL'];
export const TALLAS_PANTALON = ['28', '30', '32', '34', '36', '38', '40', '42'];
export const TALLA_UNICA = ['Única'];

const SINONIMOS_TALLA: Record<string, string> = {
  XXXL: '3XL',
  XXXXL: '4XL',
  '2XL': 'XXL',
  SS: 'XS',
  CH: 'S',
  P: 'S',
  MED: 'M',
  G: 'L',
  EG: 'XL',
};

function normalizarTalla(t: string): string | null {
  const x = t.trim().toUpperCase().replace(/\.$/, '');
  if (!x) return null;
  if (/^[ÚU]NICA$|^STD$|^ESTANDAR$|^ESTÁNDAR$|^AJUSTABLE$/.test(x)) return 'Única';
  if (SINONIMOS_TALLA[x]) return SINONIMOS_TALLA[x];
  if (TALLAS_LETRA.includes(x)) return x;
  if (/^\d{1,2}$/.test(x) && Number(x) >= 2 && Number(x) <= 60) return String(Number(x));
  return null;
}

/** Ordena tallas de letra según la escala y las numéricas de menor a mayor. */
export function ordenarTallas(tallas: string[]): string[] {
  const unicas = [...new Set(tallas)];
  return unicas.sort((a, b) => {
    const ia = TALLAS_LETRA.indexOf(a);
    const ib = TALLAS_LETRA.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) - Number(b);
    return ia >= 0 ? -1 : ib >= 0 ? 1 : a.localeCompare(b);
  });
}

/**
 * Lee tallas de textos como "Tallas: S, M, L", "S-M-L-XL", "tallas S a XXL", "28 al 40", "Talla única".
 * Devuelve null si no encuentra tallas.
 */
export function leerTallas(texto: string): string[] | null {
  const t = texto.replace(/\s+/g, ' ');
  if (/talla\s+[úu]nica|[úu]nica\s+talla|^\s*[úu]nica\s*$|ajustable/i.test(t)) return TALLA_UNICA;

  // Rango: "S a XXL", "desde la S hasta la XL", "28 al 40"
  const rango = t.match(
    /(?:tallas?\s*:?\s*(?:de(?:sde)?\s+(?:la\s+)?)?)?\b(XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL|\d{1,2})\s*(?:al\b|a\b|hasta(?:\s+la)?\b|–|—)\s*(XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL|\d{1,2})\b/i,
  );
  if (rango && (/talla/i.test(t) || /^[\s\w–—-]*$/.test(t))) {
    const a = normalizarTalla(rango[1]);
    const b = normalizarTalla(rango[2]);
    if (a && b) {
      const ia = TALLAS_LETRA.indexOf(a);
      const ib = TALLAS_LETRA.indexOf(b);
      if (ia >= 0 && ib >= 0 && ia <= ib) return TALLAS_LETRA.slice(ia, ib + 1);
      if (/^\d+$/.test(a) && /^\d+$/.test(b) && Number(a) < Number(b)) {
        const paso = Number(a) % 2 === Number(b) % 2 && Number(b) - Number(a) > 6 ? 2 : 1;
        const res: string[] = [];
        for (let n = Number(a); n <= Number(b); n += paso) res.push(String(n));
        return res;
      }
    }
  }

  // Lista después de "talla(s)": "Tallas: S, M, L, XL"
  const tras = t.match(/tallas?\s*:?\s*([A-Z0-9ÚÁ ,;/|\-–y]+)/i);
  const candidatos = tras ? tras[1] : /talla/i.test(t) ? '' : t;
  if (candidatos) {
    const piezas = candidatos.split(/[\s,;/|\-–]+|\by\b/i).filter(Boolean);
    const leidas = piezas.map(normalizarTalla);
    const validas = leidas.filter((x): x is string => !!x);
    // Para evitar falsos positivos en texto libre, exigimos al menos 2 tallas y que casi todo sean tallas.
    if (validas.length >= 2 && (tras || validas.length >= piezas.length * 0.8)) {
      return ordenarTallas(validas);
    }
    if (validas.length === 1 && validas[0] === 'Única') return TALLA_UNICA;
  }
  return null;
}

const COLORES: { claves: RegExp; nombre: string; hex: string }[] = [
  { claves: /azul\s+marino|navy|marino/i, nombre: 'Azul marino', hex: '#1f2a44' },
  { claves: /azul\s+rey|royal/i, nombre: 'Azul rey', hex: '#1f4fb4' },
  { claves: /azul\s+cielo|celeste|azul\s+claro/i, nombre: 'Azul cielo', hex: '#7fb3e0' },
  { claves: /turquesa/i, nombre: 'Turquesa', hex: '#1aa3a3' },
  { claves: /\bazul\b(?!\s+(marino|rey|cielo|claro))/i, nombre: 'Azul', hex: '#2b5ca8' },
  { claves: /\bnegro\b|\bblack\b/i, nombre: 'Negro', hex: '#1b1c1f' },
  { claves: /\bblanco\b|\bwhite\b/i, nombre: 'Blanco', hex: '#f2f2ee' },
  { claves: /gris\s+(oscuro|plomo|grafito)|grafito|plomo/i, nombre: 'Gris oscuro', hex: '#4a4e57' },
  { claves: /gris\s+(claro|perla|jaspe)|jaspeado/i, nombre: 'Gris claro', hex: '#b9bcc2' },
  { claves: /\bgris\b(?!\s+(oscuro|plomo|grafito|claro|perla|jaspe))/i, nombre: 'Gris', hex: '#80848c' },
  { claves: /vinotinto|vino\s+tinto|burdeos|bord[oó]/i, nombre: 'Vinotinto', hex: '#6b1f2a' },
  { claves: /\brojo\b|\bred\b/i, nombre: 'Rojo', hex: '#b3232f' },
  { claves: /verde\s+(oliva|militar)|oliva/i, nombre: 'Verde oliva', hex: '#5b6236' },
  { claves: /verde\s+(manzana|lim[oó]n)/i, nombre: 'Verde manzana', hex: '#7cb342' },
  { claves: /\bverde\b(?!\s+(oliva|militar|manzana|lim))/i, nombre: 'Verde', hex: '#2e7d4f' },
  { claves: /\bamarillo\b/i, nombre: 'Amarillo', hex: '#e8b923' },
  { claves: /naranja|anaranjado|\borange\b/i, nombre: 'Naranja', hex: '#e46a1c' },
  { claves: /kaki|caqui|khaki|beige|arena/i, nombre: 'Kaki', hex: '#c2a878' },
  { claves: /marr[oó]n|caf[eé]|chocolate/i, nombre: 'Marrón', hex: '#5e4030' },
  { claves: /\brosado\b|\brosa\b|\bpink\b/i, nombre: 'Rosado', hex: '#e48aa6' },
  { claves: /morado|p[uú]rpura|lila/i, nombre: 'Morado', hex: '#5d3a8c' },
];

/** Colores nombrados en el texto, en el orden en que aparecen. */
export function leerColores(texto: string): ColorProducto[] {
  const encontrados: { pos: number; color: ColorProducto }[] = [];
  for (const c of COLORES) {
    const m = texto.match(c.claves);
    if (m && m.index !== undefined && !encontrados.some((e) => e.color.nombre === c.nombre)) {
      encontrados.push({ pos: m.index, color: { nombre: c.nombre, hex: c.hex } });
    }
  }
  return encontrados.sort((a, b) => a.pos - b.pos).map((e) => e.color);
}

const FORMAS: { claves: RegExp; forma: Forma3D }[] = [
  { claves: /gorra|cap\b|visera|trucker|snapback|sombrero/i, forma: 'gorra' },
  { claves: /pantal[oó]n|jean|short|bermuda|mono\s+deportivo/i, forma: 'pantalon' },
  { claves: /chaleco|vest\b/i, forma: 'chaleco' },
  { claves: /chaqueta|chamarra|jacket|softshell|cortavientos|su[eé]ter|sweater|hoodie|abrigo|blazer|bata|filipina|braga|overol/i, forma: 'chaqueta' },
  { claves: /chemise|polo|piqu[eé]/i, forma: 'chemise' },
  { claves: /camisa|oxford|blusa|guayabera/i, forma: 'camisa' },
  { claves: /franela|camiseta|t-?shirt|playera|remera/i, forma: 'franela' },
];

export function leerForma(texto: string): Forma3D | null {
  for (const f of FORMAS) if (f.claves.test(texto)) return f.forma;
  return null;
}

export function tallasPorDefecto(forma: Forma3D): string[] {
  if (forma === 'gorra') return TALLA_UNICA;
  if (forma === 'pantalon') return TALLAS_PANTALON;
  return TALLAS_SUPERIOR;
}

const RE_CODIGO_ETIQUETA =
  /(?:c[oó]d(?:igo)?|ref(?:erencia)?|art(?:[ií]culo)?|modelo|mod|sku|item)\s*(?:n[°ºo.]\s*)?[.:#\-]?\s*([A-Z0-9][A-Z0-9\-_/.]{1,18}[A-Z0-9])/i;
const RE_CODIGO_SUELTO = /\b([A-Z]{1,6}[-_ ]?\d{2,6}(?:[-_][A-Z0-9]{1,4})?)\b/;

/** Busca el código del artículo. Primero uno con etiqueta ("Código: X"), luego uno con forma de código. */
export function leerCodigo(texto: string): string | null {
  const m = texto.match(RE_CODIGO_ETIQUETA);
  if (m && /\d/.test(m[1])) return m[1].toUpperCase();
  const s = texto.match(RE_CODIGO_SUELTO);
  if (s && !/^(TALLA|PRECIO|USD|REF)\b/i.test(s[1])) return s[1].toUpperCase().replace(/\s+/g, '-');
  return null;
}

const RE_PRECIO =
  /(?:precio(?:\s+(?:al\s+)?mayor)?|p\.?\s*mayor|mayor|pvp|costo|valor)?\s*[:=]?\s*(?:US\$|USD|\$|€|Bs\.?|REF\.?)\s*([\d.,]+)|([\d][\d.,]*)\s*(?:US\$|USD|\$|€)/i;

/** Precio con símbolo de moneda; si hay varios, prefiere el que dice "mayor". */
export function leerPrecio(texto: string): number | null {
  const lineas = texto.split(/\n|(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/);
  const conMayor = lineas.find((l) => /mayor/i.test(l) && RE_PRECIO.test(l));
  const fuente = conMayor ?? texto;
  const m = fuente.match(RE_PRECIO);
  if (!m) return null;
  return aCentavos(m[1] ?? m[2]);
}

export function leerMinimo(texto: string): number | null {
  const m = texto.match(/(?:m[ií]nimo|min\.?|desde)\s*(?:de\s*)?(\d{1,4})\s*(?:unid|pzas?|piezas|uds?|docenas?)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return /docena/i.test(m[0]) ? n * 12 : n;
}

/** Limpia una línea de catálogo: espacios repetidos y viñetas. */
export function limpiarLinea(l: string): string {
  return l
    .replace(/\s+/g, ' ')
    .replace(/^[•·▪■◆►\-–*]+\s*/, '')
    .trim();
}

export interface DatosLeidos {
  codigo: string | null;
  nombre: string | null;
  descripcion: string;
  precioCentavos: number | null;
  tallas: string[] | null;
  colores: ColorProducto[];
  forma: Forma3D | null;
  minimo: number | null;
}

const RE_LINEA_DATO = /^(?:c[oó]d(?:igo)?|ref(?:erencia)?|sku|art[ií]culo|modelo|precio|p\.?\s*mayor|tallas?|colou?r(?:es)?|m[ií]nimo)\b/i;

/** Interpreta las líneas de texto de un bloque de producto. */
export function interpretarBloque(lineas: string[]): DatosLeidos {
  const limpias = lineas.map(limpiarLinea).filter((l) => l.length > 0);
  const texto = limpias.join('\n');
  const codigo = leerCodigo(texto);

  // Nombre: primera línea que no sea un dato (código, precio, tallas) ni solo el código.
  const nombre =
    limpias.find(
      (l) =>
        !RE_LINEA_DATO.test(l) &&
        (!codigo || l.toUpperCase() !== codigo) &&
        /\p{L}{3,}/u.test(l) &&
        l.length <= 80 &&
        !/^[\d\s.,$€-]+$/.test(l),
    ) ?? null;

  const descripcion = limpias
    .filter((l) => l !== nombre && !RE_LINEA_DATO.test(l) && (!codigo || l.toUpperCase() !== codigo))
    .join(' ')
    .trim();

  return {
    codigo,
    nombre,
    descripcion,
    precioCentavos: leerPrecio(texto),
    tallas: leerTallas(limpias.filter((l) => /talla|\b(XS|S|M|L|XL|XXL)\b/.test(l)).join(' ')) ?? null,
    colores: leerColores(texto),
    forma: leerForma(texto),
    minimo: leerMinimo(texto),
  };
}
