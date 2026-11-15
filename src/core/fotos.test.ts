import { describe, expect, it } from 'vitest';
import { contarFotos, mapearFotos, nombreBase, quitarFotos, reconocerFotos } from './fotos';
import type { Catalogo, Producto } from './modelo';

const producto = (id: string, codigo: string, extra: Partial<Producto> = {}): Producto => ({
  id,
  codigo,
  nombre: codigo,
  descripcion: '',
  categoria: '',
  forma: 'franela',
  colores: [
    { nombre: 'Blanco (01)', hex: '#ffffff', codigo: '01' },
    { nombre: 'Azul marino', hex: '#1f2a44' },
  ],
  tallas: ['M'],
  precioCentavos: null,
  minimo: 0,
  foto: null,
  origen: '',
  avisos: [],
  ...extra,
});

const productos = [producto('a', '2800'), producto('b', '1602'), producto('c', '160204'), producto('d', 'B051402')];

describe('reconocerFotos', () => {
  it('reconoce frente, espalda, detalles y colores por el nombre', () => {
    const r = reconocerFotos(
      ['2800.jpg', '2800-espalda.JPG', '2800-2.png', '2800 detalle 3.webp', '2800-color-01.jpg', '2800_color_azul-marino.jpg', 'b051402.jpeg'],
      productos,
    );
    expect(r.sinAsignar).toEqual([]);
    const de = (archivo: string) => r.asignadas.find((x) => x.archivo === archivo);
    expect(de('2800.jpg')).toMatchObject({ productoId: 'a', rol: 'frente' });
    expect(de('2800-espalda.JPG')).toMatchObject({ productoId: 'a', rol: 'espalda' });
    expect(de('2800-2.png')).toMatchObject({ productoId: 'a', rol: 'detalle', orden: 2 });
    expect(de('2800 detalle 3.webp')).toMatchObject({ rol: 'detalle', orden: 3 });
    expect(de('2800-color-01.jpg')).toMatchObject({ rol: 'color', color: 'Blanco (01)' });
    expect(de('2800_color_azul-marino.jpg')).toMatchObject({ rol: 'color', color: 'Azul marino' });
    expect(de('b051402.jpeg')).toMatchObject({ productoId: 'd', rol: 'frente' });
  });

  it('prefiere el código más largo y exige un separador después del código', () => {
    const r = reconocerFotos(['160204.jpg', '1602.jpg', '28001.jpg'], productos);
    expect(r.asignadas.map((x) => [x.archivo, x.productoId])).toEqual([
      ['1602.jpg', 'b'],
      ['160204.jpg', 'c'],
    ]);
    expect(r.sinAsignar).toEqual([{ archivo: '28001.jpg', motivo: expect.stringContaining('no empieza por el código') }]);
  });

  it('informa lo que no puede asignar, con su motivo', () => {
    const r = reconocerFotos(['2800.jpg', '2800-frente.jpg', '2800-color-99.jpg', '2800-lateral.jpg', 'notas.txt'], productos);
    expect(r.asignadas.map((x) => x.archivo)).toEqual(['2800.jpg']);
    const motivos = Object.fromEntries(r.sinAsignar.map((x) => [x.archivo, x.motivo]));
    expect(motivos['2800-frente.jpg']).toContain('Ya hay otra foto de frente');
    expect(motivos['2800-color-99.jpg']).toContain('no tiene el color');
    expect(motivos['2800-lateral.jpg']).toContain('No se entiende');
    expect(motivos['notas.txt']).toContain('No es una imagen');
  });

  it('ignora la carpeta del archivo', () => {
    const r = reconocerFotos(['nuevas/2800.jpg'], productos);
    expect(r.asignadas[0]).toMatchObject({ productoId: 'a', rol: 'frente' });
  });
});

describe('fotos del catálogo', () => {
  const conFotos = producto('a', 'KV 101/A', {
    foto: 'data:image/webp;base64,AAA',
    fotoEspalda: 'fotos/kv-101-a-espalda.webp',
    fotos: ['data:image/webp;base64,BBB'],
    colores: [{ nombre: 'Blanco (01)', hex: '#fff', codigo: '01', foto: 'data:image/webp;base64,CCC', fotoProducto: 'data:image/webp;base64,DDD' }],
  });

  it('quita todas las fotos sin tocar lo demás', () => {
    const [p] = quitarFotos([conFotos]);
    expect(p).toMatchObject({ foto: null, fotoEspalda: null, fotos: [], codigo: 'KV 101/A' });
    expect(p.colores[0]).toMatchObject({ foto: null, fotoProducto: null, codigo: '01', hex: '#fff' });
  });

  it('nombra los archivos con el código', async () => {
    expect(nombreBase(conFotos)).toBe('kv-101-a');
    expect(nombreBase(producto('prd-x1', ''))).toBe('prd-x1');
    const nombres: string[] = [];
    const p = await mapearFotos(conFotos, async (_f, nombre) => {
      nombres.push(nombre);
      return `fotos/${nombre}.webp`;
    });
    expect(nombres.sort()).toEqual(['kv-101-a', 'kv-101-a-2', 'kv-101-a-color-01', 'kv-101-a-espalda', 'kv-101-a-muestra-01']);
    expect(p.foto).toBe('fotos/kv-101-a.webp');
    expect(p.colores[0].foto).toBe('fotos/kv-101-a-muestra-01.webp');
    expect(p.colores[0].fotoProducto).toBe('fotos/kv-101-a-color-01.webp');
  });

  it('cuenta las fotos incrustadas', () => {
    const cat = { version: 1, ajustes: {}, productos: [conFotos], publicadoEn: null } as unknown as Catalogo;
    expect(contarFotos(cat)).toEqual({ total: 5, incrustadas: 4 });
  });
});
