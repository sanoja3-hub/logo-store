import { tallasPorDefecto, type DatosLeidos } from '../core/interpretar';
import { nuevoId, type ColorProducto, type Producto } from '../core/modelo';
import { nombreDeColor, type FotoNormalizada } from './imagenes';

/** Convierte lo leído de un bloque del catálogo en un producto, anotando lo que falta revisar. */
export function armarProducto(datos: DatosLeidos, foto: FotoNormalizada | null, origen: string): Producto {
  const avisos: string[] = [];
  const forma = datos.forma ?? 'franela';
  if (!datos.forma) avisos.push('No se reconoció el tipo de prenda: se muestra como franela.');
  if (!datos.codigo) avisos.push('Falta el código del artículo.');
  if (!datos.nombre) avisos.push('Falta el nombre del artículo.');
  if (!foto) avisos.push('No se encontró la foto.');
  if (!datos.tallas) avisos.push('El catálogo no indica tallas: se usan las tallas habituales.');

  let colores: ColorProducto[] = datos.colores;
  if (colores.length === 0 && foto?.colorHex) {
    colores = [{ nombre: nombreDeColor(foto.colorHex), hex: foto.colorHex }];
    avisos.push('Color tomado de la foto: confírmalo.');
  }

  return {
    id: nuevoId('prd'),
    codigo: datos.codigo ?? '',
    nombre: datos.nombre ?? '',
    descripcion: datos.descripcion,
    categoria: categoriaDe(forma),
    forma,
    colores,
    tallas: datos.tallas ?? tallasPorDefecto(forma),
    precioCentavos: datos.precioCentavos,
    minimo: datos.minimo ?? 0,
    foto: foto?.dataUrl ?? null,
    origen,
    avisos,
  };
}

export function categoriaDe(forma: Producto['forma']): string {
  switch (forma) {
    case 'gorra':
      return 'Gorras';
    case 'pantalon':
      return 'Pantalones';
    case 'chaqueta':
    case 'chaleco':
      return 'Chaquetas y chalecos';
    case 'camisa':
    case 'camisa_corta':
      return 'Camisas';
    case 'otro':
      return 'Accesorios';
    default:
      return 'Franelas y chemises';
  }
}
