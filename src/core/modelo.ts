// Modelo de datos del showroom. El dinero va siempre en centavos enteros (ver dinero.ts).

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
  /** Foto pequeña de la prenda en ese color, si el catálogo la trae. */
  foto?: string | null;
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
  /** Precio por unidad al mayor, en centavos. null si el catálogo no lo trae. */
  precioCentavos: number | null;
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

export interface Ajustes {
  empresa: string;
  lema: string;
  /** Número de WhatsApp del asesor, solo dígitos con código de país (ej. 584141234567). */
  whatsappAsesor: string;
  correoAsesor: string;
  moneda: string;
  mostrarPrecios: boolean;
}

export interface Catalogo {
  version: 1;
  ajustes: Ajustes;
  productos: Producto[];
  publicadoEn: string | null;
}

export type Ubicacion = 'pecho_izquierdo' | 'pecho_centro' | 'espalda' | 'manga' | 'frente_gorra' | 'sin_logo';

export const UBICACIONES: Record<Ubicacion, string> = {
  pecho_izquierdo: 'Pecho izquierdo',
  pecho_centro: 'Pecho centro',
  espalda: 'Espalda',
  manga: 'Manga',
  frente_gorra: 'Frente de la gorra',
  sin_logo: 'Sin logo',
};

export function ubicacionesPara(forma: Forma3D): Ubicacion[] {
  if (forma === 'otro') return ['sin_logo'];
  if (forma === 'gorra') return ['frente_gorra', 'sin_logo'];
  if (forma === 'pantalon') return ['pecho_izquierdo', 'sin_logo'];
  if (forma === 'chaleco') return ['pecho_izquierdo', 'pecho_centro', 'espalda', 'sin_logo'];
  return ['pecho_izquierdo', 'pecho_centro', 'espalda', 'manga', 'sin_logo'];
}

export const TECNICAS = ['Bordado', 'Estampado DTF', 'Serigrafía', 'Sublimación', 'Por definir con el asesor'] as const;
export type Tecnica = (typeof TECNICAS)[number];

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
  precioCentavos: number | null;
  ubicacion: Ubicacion;
  tecnica: Tecnica;
  nota: string;
  /** Captura del visor 3D con el logo puesto, para que el asesor vea cómo lo pidió el cliente. */
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
  empresa: 'Atelier Uniformes',
  lema: 'Uniformes corporativos al mayor',
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
