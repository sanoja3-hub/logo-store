// Modelo de datos del showroom. El dinero va siempre en centavos enteros (ver dinero.ts).

import type { Personalizacion, Posicion, PreciosNivel, Reglas } from './reglas';

/** Forma 3D con la que se muestra la prenda en el visor. */
export type Forma3D =
  | 'franela'
  | 'chemise'
  | 'camisa'
  | 'camisa_corta'
  | 'chaqueta'
  | 'chaleco'
  | 'pantalon'
  | 'gorra'
  /** Calzado, correas y accesorios: no hay modelo 3D genérico, se muestra la foto real en 3D. */
  | 'otro';

export const FORMAS_3D: { valor: Forma3D; etiqueta: string }[] = [
  { valor: 'franela', etiqueta: 'Franela / camiseta' },
  { valor: 'chemise', etiqueta: 'Chemise (polo)' },
  { valor: 'camisa', etiqueta: 'Camisa manga larga' },
  { valor: 'camisa_corta', etiqueta: 'Camisa manga corta' },
  { valor: 'chaqueta', etiqueta: 'Chaqueta / abrigo' },
  { valor: 'chaleco', etiqueta: 'Chaleco' },
  { valor: 'pantalon', etiqueta: 'Pantalón' },
  { valor: 'gorra', etiqueta: 'Gorra' },
  { valor: 'otro', etiqueta: 'Otro (calzado, accesorios): solo foto' },
];

/** Formas que tienen un modelo 3D genérico donde se puede poner el logo. */
export function tieneModelo3D(forma: Forma3D): boolean {
  return forma !== 'otro';
}

export interface ColorProducto {
  nombre: string;
  hex: string;
  /** Código del color en el catálogo del proveedor (ej. «06»). */
  codigo?: string;
  /** Muestra pequeña del color (la de la carta de colores del catálogo). */
  foto?: string | null;
  /** Foto completa de la prenda en ese color: es la que se ve en «Foto 3D» al elegir el color. */
  fotoProducto?: string | null;
}

/** Dato de la ficha técnica tal como viene en el catálogo (Tallas, Material, Características…). */
export interface DatoFicha {
  titulo: string;
  texto: string;
}

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  forma: Forma3D;
  colores: ColorProducto[];
  tallas: string[];
  /** Precio por unidad de versiones anteriores (se toma como detal si no hay `precios`). */
  precioCentavos: number | null;
  /** Precios por nivel: detal, mayor y distribuidor (en centavos). */
  precios?: PreciosNivel;
  /** Precio propio de las tallas grandes, si no se usa el recargo de las reglas. */
  preciosGrandes?: Partial<PreciosNivel>;
  /** Tipo de tela (de la lista de telas de las reglas): decide qué técnicas se pueden aplicar. */
  tela?: string;
  /** Unidades disponibles por talla. Una talla sin dato no se limita. */
  stock?: Record<string, number>;
  /** Unidades mínimas por pedido de este artículo (0 = sin mínimo). */
  minimo: number;
  /** Foto del artículo (data URL webp/jpeg) o null si no se pudo leer. Es el frente en la vista «Foto 3D». */
  foto: string | null;
  /** Foto de la espalda, si el catálogo la trae: es la otra cara en la vista «Foto 3D». */
  fotoEspalda?: string | null;
  /** Fotos de detalle (bolsillos, cierres, suela…). */
  fotos?: string[];
  /** Ficha técnica tal como viene en el catálogo. */
  ficha?: DatoFicha[];
  /** De dónde salió, para revisar contra el catálogo original. */
  origen: string;
  /** Avisos de la importación que el administrador debe revisar. */
  avisos: string[];
}

export interface Vendedor {
  id: string;
  nombre: string;
  /** Solo dígitos con código de país (ej. 584141234567). */
  whatsapp: string;
}

export interface Sucursal {
  id: string;
  nombre: string;
  vendedores: Vendedor[];
}

export interface Ajustes {
  empresa: string;
  lema: string;
  /** Número de WhatsApp del asesor, solo dígitos con código de país (ej. 584141234567). */
  whatsappAsesor: string;
  correoAsesor: string;
  moneda: string;
  mostrarPrecios: boolean;
  /** PIN del panel (solo para que no entre cualquiera desde el catálogo: no es seguridad real). */
  pin?: string;
  /** Muestra el aviso de que los precios y el stock son de prueba. */
  datosDePrueba?: boolean;
  /** Imagen de portada de la empresa, arriba del catálogo (data URL o `fotos/portada.jpg`). */
  portada?: string | null;
}

export interface Catalogo {
  version: 1;
  ajustes: Ajustes;
  productos: Producto[];
  publicadoEn: string | null;
  /** Reglas de precios del cotizador. Si faltan se usan las iniciales. */
  reglas?: Reglas;
  sucursales?: Sucursal[];
}

/** Posiciones donde se puede personalizar cada tipo de prenda. */
export function posicionesPara(forma: Forma3D): Posicion[] {
  switch (forma) {
    case 'otro':
      return [];
    case 'gorra':
      return ['frente_gorra', 'lateral_gorra'];
    case 'pantalon':
      return ['bolsillo_pantalon'];
    case 'chaleco':
      return ['pecho_izquierdo', 'pecho_derecho', 'pecho_centro', 'espalda_superior', 'espalda_central'];
    default:
      return ['pecho_izquierdo', 'pecho_derecho', 'pecho_centro', 'manga_izquierda', 'manga_derecha', 'espalda_superior', 'espalda_central'];
  }
}

/** Precios del artículo por nivel (los de versiones anteriores pasan como detal). */
export function preciosDe(p: Pick<Producto, 'precios' | 'precioCentavos'>): PreciosNivel {
  return p.precios ?? { detal: p.precioCentavos, mayor: null, distribuidor: null };
}

export interface LineaPedido {
  id: string;
  productoId: string;
  /** Copia del producto al momento de agregarlo, para que la orden no cambie si cambia el catálogo. */
  codigo: string;
  nombre: string;
  foto: string | null;
  forma: Forma3D;
  color: ColorProducto | null;
  cantidades: Record<string, number>;
  /** Copia de los precios y la tela del artículo, para cotizar con las reglas. */
  precios: PreciosNivel;
  preciosGrandes?: Partial<PreciosNivel>;
  tela?: string;
  personalizaciones: Personalizacion[];
  nota: string;
  /** Captura del visor 3D con los logos puestos, para que el asesor vea cómo lo pidió el cliente. */
  vista3d: string | null;
}

export interface Cliente {
  empresa: string;
  rif: string;
  contacto: string;
  telefono: string;
  correo: string;
  ciudad: string;
  notas: string;
}

export interface LogoCliente {
  nombreArchivo: string;
  dataUrl: string;
  ancho: number;
  alto: number;
  tieneTransparencia: boolean;
}

export const AJUSTES_INICIALES: Ajustes = {
  empresa: 'Showroom de Uniformes',
  lema: 'Catálogo mayorista de uniformes y dotación',
  whatsappAsesor: '',
  correoAsesor: '',
  moneda: 'USD',
  mostrarPrecios: true,
};

export const CLIENTE_VACIO: Cliente = {
  empresa: '',
  rif: '',
  contacto: '',
  telefono: '',
  correo: '',
  ciudad: '',
  notas: '',
};

export function totalUnidades(linea: Pick<LineaPedido, 'cantidades'>): number {
  return Object.values(linea.cantidades).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

export function nuevoId(prefijo: string): string {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
