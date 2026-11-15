// Motor de reglas de precios del cotizador. Todo el dinero en centavos enteros (ver dinero.ts).
//
// - Prenda: tres precios por artículo (detal, mayor, distribuidor). El nivel lo da la cantidad.
// - Tallas grandes (2XL en adelante): recargo configurable, o precio propio del artículo.
// - Personalización: tarifa por técnica y tamaño, con descuento por volumen y mínimo por técnica.
// - Compatibilidad: qué técnicas admite cada tela y qué tamaños admite cada posición.

export type Nivel = 'detal' | 'mayor' | 'distribuidor';
export const NIVELES: { valor: Nivel; etiqueta: string }[] = [
  { valor: 'detal', etiqueta: 'Detal' },
  { valor: 'mayor', etiqueta: 'Mayor' },
  { valor: 'distribuidor', etiqueta: 'Distribuidor' },
];

export type PreciosNivel = Record<Nivel, number | null>;

export type Tamano = 'pequeno' | 'mediano' | 'grande';
export const TAMANOS: { valor: Tamano; etiqueta: string; detalle: string; cm: number }[] = [
  { valor: 'pequeno', etiqueta: 'Pequeño', detalle: 'hasta 10 cm, ideal pecho o manga', cm: 10 },
  { valor: 'mediano', etiqueta: 'Mediano', detalle: 'hasta 18 cm', cm: 18 },
  { valor: 'grande', etiqueta: 'Grande', detalle: 'hasta 28 cm, ideal espalda', cm: 28 },
];

export type Posicion =
  | 'pecho_izquierdo'
  | 'pecho_derecho'
  | 'pecho_centro'
  | 'manga_izquierda'
  | 'manga_derecha'
  | 'espalda_superior'
  | 'espalda_central'
  | 'bolsillo_pantalon'
  | 'frente_gorra'
  | 'lateral_gorra';

export const POSICIONES: Record<Posicion, string> = {
  pecho_izquierdo: 'Pecho izquierdo',
  pecho_derecho: 'Pecho derecho',
  pecho_centro: 'Pecho centro',
  manga_izquierda: 'Manga izquierda',
  manga_derecha: 'Manga derecha',
  espalda_superior: 'Espalda superior',
  espalda_central: 'Espalda central',
  bolsillo_pantalon: 'Bolsillo delantero',
  frente_gorra: 'Frente de la gorra',
  lateral_gorra: 'Lateral de la gorra',
};

export interface Tecnica {
  id: string;
  nombre: string;
  activa: boolean;
  /** Unidades mínimas del artículo para poder usar esta técnica (0 = sin mínimo). */
  minimo: number;
  /** Precio base por unidad y por posición, según el tamaño. null = ese tamaño no se ofrece. */
  precios: Record<Tamano, number | null>;
}

export interface EscalaVolumen {
  /** Desde cuántas unidades aplica. */
  desde: number;
  /** Descuento sobre el precio de la personalización, en porcentaje (0–100). */
  descuento: number;
}

export interface Reglas {
  /** Desde cuántas unidades se pasa a precio mayor y a distribuidor. */
  niveles: { mayorDesde: number; distribuidorDesde: number };
  /** Qué se cuenta para el nivel y las escalas: las unidades del artículo o las de todo el pedido. */
  conteo: 'articulo' | 'pedido';
  tallasGrandes: { tallas: string[]; tipo: 'porcentaje' | 'monto'; /** % o centavos por unidad. */ valor: number };
  tecnicas: Tecnica[];
  escalas: EscalaVolumen[];
  telas: string[];
  /** Por tela, las técnicas permitidas (id). Una tela sin entrada admite todas. */
  telaTecnicas: Record<string, string[]>;
  /** Por posición, los tamaños permitidos. Una posición sin entrada admite todos. */
  posicionTamanos: Partial<Record<Posicion, Tamano[]>>;
}

const usd = (n: number) => Math.round(n * 100);

export const REGLAS_INICIALES: Reglas = {
  niveles: { mayorDesde: 12, distribuidorDesde: 100 },
  conteo: 'articulo',
  tallasGrandes: { tallas: ['2XL', '3XL', '4XL', '5XL', '6XL'], tipo: 'porcentaje', valor: 15 },
  tecnicas: [
    { id: 'bordado', nombre: 'Bordado', activa: true, minimo: 0, precios: { pequeno: usd(3.5), mediano: usd(6), grande: usd(11) } },
    { id: 'sublimado', nombre: 'Sublimado', activa: true, minimo: 0, precios: { pequeno: usd(2), mediano: usd(3.5), grande: usd(6) } },
    { id: 'dtf', nombre: 'Estampado DTF', activa: true, minimo: 0, precios: { pequeno: usd(2.5), mediano: usd(4), grande: usd(7) } },
    { id: 'serigrafia', nombre: 'Serigrafía', activa: true, minimo: 12, precios: { pequeno: usd(1.5), mediano: usd(2.5), grande: usd(4) } },
    { id: 'vinil', nombre: 'Vinil textil', activa: true, minimo: 0, precios: { pequeno: usd(2), mediano: usd(3.5), grande: usd(6.5) } },
  ],
  escalas: [
    { desde: 1, descuento: 0 },
    { desde: 12, descuento: 15 },
    { desde: 50, descuento: 30 },
  ],
  telas: ['Algodón 100%', 'Algodón/Poliéster', 'Poliéster', 'Piqué', 'Microfibra', 'Drill', 'Gabardina stretch', 'Jean', 'Nylon'],
  telaTecnicas: {
    'Algodón 100%': ['bordado', 'dtf', 'serigrafia', 'vinil'],
    'Algodón/Poliéster': ['bordado', 'dtf', 'serigrafia', 'vinil'],
    Poliéster: ['bordado', 'sublimado', 'dtf', 'serigrafia', 'vinil'],
    Piqué: ['bordado', 'dtf', 'serigrafia', 'vinil'],
    Microfibra: ['bordado', 'sublimado', 'dtf'],
    Drill: ['bordado', 'dtf', 'serigrafia'],
    'Gabardina stretch': ['bordado', 'dtf'],
    Jean: ['bordado', 'dtf'],
    Nylon: ['bordado', 'dtf', 'vinil'],
  },
  posicionTamanos: {
    pecho_izquierdo: ['pequeno'],
    pecho_derecho: ['pequeno'],
    pecho_centro: ['pequeno', 'mediano'],
    manga_izquierda: ['pequeno'],
    manga_derecha: ['pequeno'],
    espalda_superior: ['pequeno', 'mediano'],
    espalda_central: ['mediano', 'grande'],
    bolsillo_pantalon: ['pequeno'],
    frente_gorra: ['pequeno'],
    lateral_gorra: ['pequeno'],
  },
};

/** Completa unas reglas guardadas con lo que les falte (por ejemplo, de una versión anterior). */
export function reglasCompletas(r: Partial<Reglas> | undefined | null): Reglas {
  return { ...REGLAS_INICIALES, ...(r ?? {}) };
}

export function nivelPorCantidad(unidades: number, r: Reglas): Nivel {
  if (unidades >= r.niveles.distribuidorDesde) return 'distribuidor';
  if (unidades >= r.niveles.mayorDesde) return 'mayor';
  return 'detal';
}

/** Precio del nivel; si el artículo no lo trae, el del nivel anterior (distribuidor → mayor → detal). */
export function precioDelNivel(precios: PreciosNivel, nivel: Nivel): number | null {
  const orden: Nivel[] = nivel === 'distribuidor' ? ['distribuidor', 'mayor', 'detal'] : nivel === 'mayor' ? ['mayor', 'detal'] : ['detal'];
  for (const n of orden) if (precios[n] !== null && precios[n] !== undefined) return precios[n];
  return null;
}

const normalTalla = (t: string) => t.toUpperCase().replace(/\s+/g, '').replace(/^XXL$/, '2XL').replace(/^XXXL$/, '3XL');

export function esTallaGrande(talla: string, r: Reglas): boolean {
  return r.tallasGrandes.tallas.some((t) => normalTalla(t) === normalTalla(talla));
}

/** Precio unitario de una talla: el propio de tallas grandes si el artículo lo trae, o el recargo de las reglas. */
export function precioTalla(
  talla: string,
  nivel: Nivel,
  precios: PreciosNivel,
  preciosGrandes: Partial<PreciosNivel> | undefined,
  r: Reglas,
): number | null {
  const base = precioDelNivel(precios, nivel);
  if (!esTallaGrande(talla, r)) return base;
  const propio = preciosGrandes ? precioDelNivel({ detal: null, mayor: null, distribuidor: null, ...preciosGrandes }, nivel) : null;
  if (propio !== null) return propio;
  if (base === null) return null;
  return r.tallasGrandes.tipo === 'porcentaje' ? Math.round((base * (100 + r.tallasGrandes.valor)) / 100) : base + r.tallasGrandes.valor;
}

export function escalaPorCantidad(unidades: number, r: Reglas): EscalaVolumen {
  let mejor: EscalaVolumen = { desde: 0, descuento: 0 };
  for (const e of r.escalas) if (unidades >= e.desde && e.desde >= mejor.desde) mejor = e;
  return mejor;
}

export function tecnicasPermitidas(tela: string | undefined, r: Reglas): Tecnica[] {
  const activas = r.tecnicas.filter((t) => t.activa);
  const permitidas = tela ? r.telaTecnicas[tela] : undefined;
  return permitidas ? activas.filter((t) => permitidas.includes(t.id)) : activas;
}

export function tamanosPermitidos(posicion: Posicion, tecnica: Tecnica | undefined, r: Reglas): Tamano[] {
  const porPosicion = r.posicionTamanos[posicion] ?? TAMANOS.map((t) => t.valor);
  return porPosicion.filter((t) => !tecnica || tecnica.precios[t] !== null);
}

// ——— Cotización de una línea del pedido ———

export interface Personalizacion {
  id: string;
  posicion: Posicion;
  tecnica: string;
  tamano: Tamano;
}

export interface LineaCotizable {
  cantidades: Record<string, number>;
  precios: PreciosNivel;
  preciosGrandes?: Partial<PreciosNivel>;
  tela?: string;
  personalizaciones: Personalizacion[];
}

export interface CotizacionTalla {
  talla: string;
  cantidad: number;
  precioUnitario: number | null;
  subtotal: number | null;
  grande: boolean;
}

export interface CotizacionPersonalizacion {
  id: string;
  posicion: Posicion;
  tecnica: string;
  tecnicaNombre: string;
  tamano: Tamano;
  precioBase: number | null;
  descuento: number;
  precioUnitario: number | null;
  subtotal: number | null;
  /** Por qué no se puede aplicar (técnica no permitida en la tela, tamaño bloqueado, bajo el mínimo…). */
  error: string | null;
}

export interface Cotizacion {
  unidades: number;
  /** Unidades con las que se eligió el nivel y la escala (las del artículo o las del pedido). */
  unidadesConteo: number;
  nivel: Nivel;
  tallas: CotizacionTalla[];
  prendaSubtotal: number | null;
  personalizaciones: CotizacionPersonalizacion[];
  /** Costo de personalización por unidad (suma de las posiciones válidas). */
  personalizacionUnitaria: number;
  personalizacionSubtotal: number;
  subtotal: number | null;
  errores: string[];
}

export function totalUnidadesDe(cantidades: Record<string, number>): number {
  return Object.values(cantidades).reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? Math.floor(b) : 0), 0);
}

/**
 * Cotiza una línea. `unidadesPedido` es el total de prendas del pedido, que se usa cuando las reglas cuentan
 * por pedido; si no se indica, se cuentan las del artículo.
 */
export function cotizar(l: LineaCotizable, r: Reglas, unidadesPedido?: number): Cotizacion {
  const unidades = totalUnidadesDe(l.cantidades);
  const unidadesConteo = r.conteo === 'pedido' && unidadesPedido !== undefined ? Math.max(unidadesPedido, unidades) : unidades;
  const nivel = nivelPorCantidad(unidadesConteo, r);
  const errores: string[] = [];

  let prendaSubtotal: number | null = 0;
  const tallas: CotizacionTalla[] = [];
  for (const [talla, n] of Object.entries(l.cantidades)) {
    const cantidad = Math.max(0, Math.floor(n || 0));
    if (!cantidad) continue;
    const precioUnitario = precioTalla(talla, nivel, l.precios, l.preciosGrandes, r);
    const subtotal = precioUnitario === null ? null : precioUnitario * cantidad;
    if (subtotal === null) prendaSubtotal = null;
    else if (prendaSubtotal !== null) prendaSubtotal += subtotal;
    tallas.push({ talla, cantidad, precioUnitario, subtotal, grande: esTallaGrande(talla, r) });
  }

  const escala = escalaPorCantidad(unidadesConteo, r);
  const permitidas = tecnicasPermitidas(l.tela, r);
  let personalizacionUnitaria = 0;
  const personalizaciones = l.personalizaciones.map((p): CotizacionPersonalizacion => {
    const tecnica = r.tecnicas.find((t) => t.id === p.tecnica);
    const nombre = tecnica?.nombre ?? p.tecnica;
    let error: string | null = null;
    if (!tecnica || !tecnica.activa) error = `${nombre} no está disponible.`;
    else if (!permitidas.some((t) => t.id === tecnica.id)) error = `${nombre} no se puede aplicar en ${l.tela}.`;
    else if (!tamanosPermitidos(p.posicion, tecnica, r).includes(p.tamano))
      error = `Tamaño ${TAMANOS.find((t) => t.valor === p.tamano)?.etiqueta.toLowerCase()} no permitido en ${POSICIONES[p.posicion].toLowerCase()}.`;
    else if (tecnica.minimo > 0 && unidades < tecnica.minimo) error = `${nombre} exige mínimo ${tecnica.minimo} unidades (llevas ${unidades}).`;
    const precioBase = tecnica?.precios[p.tamano] ?? null;
    const precioUnitario = error || precioBase === null ? null : Math.round((precioBase * (100 - escala.descuento)) / 100);
    if (precioUnitario !== null) personalizacionUnitaria += precioUnitario;
    if (error) errores.push(`${POSICIONES[p.posicion]}: ${error}`);
    return {
      id: p.id,
      posicion: p.posicion,
      tecnica: p.tecnica,
      tecnicaNombre: nombre,
      tamano: p.tamano,
      precioBase,
      descuento: escala.descuento,
      precioUnitario,
      subtotal: precioUnitario === null ? null : precioUnitario * unidades,
      error,
    };
  });
  const personalizacionSubtotal = personalizacionUnitaria * unidades;

  return {
    unidades,
    unidadesConteo,
    nivel,
    tallas,
    prendaSubtotal,
    personalizaciones,
    personalizacionUnitaria,
    personalizacionSubtotal,
    subtotal: prendaSubtotal === null ? null : prendaSubtotal + personalizacionSubtotal,
    errores,
  };
}

