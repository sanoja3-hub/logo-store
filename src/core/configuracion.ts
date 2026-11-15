// Configuración del negocio en un JSON liviano (sin fotos): reglas, ajustes, sucursales y, por artículo, sus
// precios y tela. Sirve para actualizar los precios de la app publicada cargando un solo archivo.

import type { Ajustes, Catalogo, Producto, Sucursal } from './modelo';
import { reglasCompletas, type Reglas } from './reglas';

type DatosArticulo = Pick<Producto, 'precios' | 'preciosGrandes' | 'tela' | 'minimo'> & { codigo: string };

export interface Configuracion {
  tipo: 'configuracion-showroom';
  version: 1;
  exportadoEn: string;
  ajustes: Omit<Ajustes, 'portada'>;
  reglas: Reglas;
  sucursales: Sucursal[];
  articulos: DatosArticulo[];
}

export function exportarConfiguracion(cat: Catalogo, ahora = new Date()): Configuracion {
  const { portada: _portada, ...ajustes } = cat.ajustes;
  return {
    tipo: 'configuracion-showroom',
    version: 1,
    exportadoEn: ahora.toISOString(),
    ajustes,
    reglas: reglasCompletas(cat.reglas),
    sucursales: cat.sucursales ?? [],
    articulos: cat.productos
      .filter((p) => p.codigo)
      .map((p) => ({ codigo: p.codigo, precios: p.precios, preciosGrandes: p.preciosGrandes, tela: p.tela, minimo: p.minimo })),
  };
}

export function esConfiguracion(x: unknown): x is Configuracion {
  const c = x as Configuracion;
  return !!c && c.tipo === 'configuracion-showroom' && c.version === 1 && Array.isArray(c.articulos);
}

/**
 * Aplica una configuración al catálogo: reemplaza reglas, ajustes y sucursales, y actualiza precios, tela de los artículos por su código. Los códigos que no están en el catálogo se informan, no se crean.
 */
export function aplicarConfiguracion(cat: Catalogo, c: Configuracion): { catalogo: Catalogo; actualizados: number; sinArticulo: string[] } {
  const porCodigo = new Map(c.articulos.map((a) => [a.codigo.trim().toUpperCase(), a]));
  let actualizados = 0;
  const productos = cat.productos.map((p) => {
    const a = porCodigo.get(p.codigo.trim().toUpperCase());
    if (!a) return p;
    porCodigo.delete(p.codigo.trim().toUpperCase());
    actualizados++;
    return { ...p, precios: a.precios, preciosGrandes: a.preciosGrandes, tela: a.tela, minimo: a.minimo ?? p.minimo };
  });
  return {
    catalogo: {
      ...cat,
      ajustes: { ...c.ajustes, portada: cat.ajustes.portada ?? null },
      reglas: reglasCompletas(c.reglas),
      sucursales: c.sucursales,
      productos,
    },
    actualizados,
    sinArticulo: [...porCodigo.values()].map((a) => a.codigo),
  };
}
