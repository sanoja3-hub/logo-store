// Guardado local en IndexedDB (las fotos no caben en localStorage) y carga del catálogo publicado.

import { del, get, set } from 'idb-keyval';
import { AJUSTES_INICIALES, type Catalogo, type Cliente, type LineaPedido, type LogoCliente } from './modelo';

const CLAVES = {
  borrador: 'atelier:borrador',
  publicado: 'atelier:publicado',
  pedido: 'atelier:pedido',
  cliente: 'atelier:cliente',
  logo: 'atelier:logo',
} as const;

export const catalogoVacio = (): Catalogo => ({ version: 1, ajustes: { ...AJUSTES_INICIALES }, productos: [], publicadoEn: null });

async function leer<T>(clave: string): Promise<T | undefined> {
  try {
    return await get<T>(clave);
  } catch {
    return undefined;
  }
}

async function guardar(clave: string, valor: unknown): Promise<void> {
  try {
    if (valor === null || valor === undefined) await del(clave);
    else await set(clave, valor);
  } catch (e) {
    console.warn('No se pudo guardar en este navegador', e);
  }
}

export const almacen = {
  leerBorrador: () => leer<Catalogo>(CLAVES.borrador),
  guardarBorrador: (c: Catalogo) => guardar(CLAVES.borrador, c),
  leerPublicadoLocal: () => leer<Catalogo>(CLAVES.publicado),
  guardarPublicadoLocal: (c: Catalogo) => guardar(CLAVES.publicado, c),
  leerPedido: () => leer<LineaPedido[]>(CLAVES.pedido),
  guardarPedido: (l: LineaPedido[]) => guardar(CLAVES.pedido, l),
  leerCliente: () => leer<Cliente>(CLAVES.cliente),
  guardarCliente: (c: Cliente) => guardar(CLAVES.cliente, c),
  leerLogo: () => leer<LogoCliente>(CLAVES.logo),
  guardarLogo: (l: LogoCliente | null) => guardar(CLAVES.logo, l),
};

export function esCatalogo(x: unknown): x is Catalogo {
  const c = x as Catalogo;
  return !!c && c.version === 1 && Array.isArray(c.productos) && typeof c.ajustes === 'object';
}

/**
 * Catálogo que ven los clientes: el archivo `catalogo.json` publicado junto a la web. Si en este navegador
 * se publicó una versión más reciente desde el panel, se muestra esa (sirve para revisar antes de subirla).
 */
export async function cargarCatalogoPublico(): Promise<{ catalogo: Catalogo; fuente: 'web' | 'local' | 'demo' | 'vacio' }> {
  let web: Catalogo | null = null;
  if (!__DEMO__) try {
    const r = await fetch(`${import.meta.env.BASE_URL}catalogo.json`, { cache: 'no-cache' });
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) {
      const j = await r.json();
      if (esCatalogo(j)) web = j;
    }
  } catch {
    // sin catálogo publicado en la web
  }
  const local = await almacen.leerPublicadoLocal();
  if (local && (!web || (local.publicadoEn ?? '') > (web.publicadoEn ?? ''))) return { catalogo: local, fuente: 'local' };
  if (web) return { catalogo: web, fuente: 'web' };
  if (__DEMO__) {
    const demo = (await import('catalogo-demo.json')).default as unknown;
    if (esCatalogo(demo)) return { catalogo: demo, fuente: 'demo' };
  }
  return { catalogo: catalogoVacio(), fuente: 'vacio' };
}
