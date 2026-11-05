import type { Producto } from '../core/modelo';

export type Progreso = (mensaje: string, fraccion: number) => void;

export interface ResultadoImportacion {
  productos: Producto[];
  /** Avisos generales: páginas u hojas que no se pudieron leer y por qué. */
  avisos: string[];
}
