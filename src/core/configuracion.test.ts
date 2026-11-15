import { describe, expect, it } from 'vitest';
import { aplicarConfiguracion, esConfiguracion, exportarConfiguracion } from './configuracion';
import { AJUSTES_INICIALES, type Catalogo, type Producto } from './modelo';
import { REGLAS_INICIALES } from './reglas';

const producto = (codigo: string, extra: Partial<Producto> = {}): Producto => ({
  id: `id-${codigo}`,
  codigo,
  nombre: codigo,
  descripcion: '',
  categoria: '',
  forma: 'camisa',
  colores: [],
  tallas: ['M', 'L'],
  precioCentavos: null,
  minimo: 0,
  foto: 'fotos/x.webp',
  origen: '',
  avisos: [],
  ...extra,
});

const catalogo = (productos: Producto[]): Catalogo => ({
  version: 1,
  ajustes: { ...AJUSTES_INICIALES, portada: 'fotos/portada.webp' },
  productos,
  publicadoEn: null,
});

describe('configuración exportable', () => {
  it('exporta sin fotos y la vuelve a aplicar por código', () => {
    const origen = catalogo([producto('2801', { precios: { detal: 2800, mayor: 2200, distribuidor: 1800 }, tela: 'Poliéster' })]);
    origen.reglas = { ...REGLAS_INICIALES, niveles: { mayorDesde: 6, distribuidorDesde: 60 } };
    origen.sucursales = [{ id: 's1', nombre: 'Centro', vendedores: [{ id: 'v1', nombre: 'Ana', whatsapp: '584141234567' }] }];
    const conf = JSON.parse(JSON.stringify(exportarConfiguracion(origen)));
    expect(esConfiguracion(conf)).toBe(true);
    expect(JSON.stringify(conf)).not.toContain('fotos/');

    const destino = catalogo([producto('2801'), producto('2811')]);
    const r = aplicarConfiguracion(destino, { ...conf, articulos: [...conf.articulos, { codigo: '9999', precios: null }] });
    expect(r.actualizados).toBe(1);
    expect(r.sinArticulo).toEqual(['9999']);
    const p = r.catalogo.productos[0];
    expect(p).toMatchObject({ precios: { detal: 2800 }, tela: 'Poliéster', foto: 'fotos/x.webp' });
    expect(r.catalogo.productos[1].precios).toBeUndefined();
    expect(r.catalogo.reglas?.niveles.mayorDesde).toBe(6);
    expect(r.catalogo.sucursales?.[0].vendedores[0].nombre).toBe('Ana');
    expect(r.catalogo.ajustes.portada).toBe('fotos/portada.webp');
  });

  it('reconoce lo que no es una configuración', () => {
    expect(esConfiguracion({ version: 1, productos: [] })).toBe(false);
  });
});
