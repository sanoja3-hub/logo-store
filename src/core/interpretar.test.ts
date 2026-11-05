import { describe, expect, it } from 'vitest';
import { aCentavos, formatoDinero } from './dinero';
import { interpretarBloque, leerCodigo, leerColores, leerForma, leerPrecio, leerTallas } from './interpretar';

describe('dinero', () => {
  it('convierte formatos venezolanos y anglosajones a centavos', () => {
    expect(aCentavos('12,50')).toBe(1250);
    expect(aCentavos('12.50')).toBe(1250);
    expect(aCentavos('1.234,50')).toBe(123450);
    expect(aCentavos('1,234.50')).toBe(123450);
    expect(aCentavos('$ 18')).toBe(1800);
    expect(aCentavos(7.3)).toBe(730);
    expect(aCentavos('')).toBeNull();
    expect(aCentavos('abc')).toBeNull();
  });
  it('formatea montos', () => {
    expect(formatoDinero(123450)).toBe('$ 1.234,50');
  });
});

describe('tallas', () => {
  it('lee listas y rangos', () => {
    expect(leerTallas('Tallas: S, M, L, XL')).toEqual(['S', 'M', 'L', 'XL']);
    expect(leerTallas('S-M-L-XL-XXL')).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
    expect(leerTallas('tallas S a XXL')).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
    expect(leerTallas('Tallas 28 al 40')).toEqual(['28', '30', '32', '34', '36', '38', '40']);
    expect(leerTallas('Talla única')).toEqual(['Única']);
    expect(leerTallas('Tallas S–XL')).toEqual(['S', 'M', 'L', 'XL']);
    expect(leerTallas('Única')).toEqual(['Única']);
  });
  it('no confunde texto libre con tallas', () => {
    expect(leerTallas('Chaqueta impermeable de alta calidad')).toBeNull();
  });
});

describe('código, precio, forma y colores', () => {
  it('lee el código con o sin etiqueta', () => {
    expect(leerCodigo('Código: UNI-101')).toBe('UNI-101');
    expect(leerCodigo('Ref. CH2045 chemise')).toBe('CH2045');
    expect(leerCodigo('Chaqueta UNI-103 softshell')).toBe('UNI-103');
    expect(leerCodigo('Chaqueta softshell')).toBeNull();
  });
  it('lee el precio solo si tiene moneda y prefiere el de mayor', () => {
    expect(leerPrecio('Precio mayor: $12.50')).toBe(1250);
    expect(leerPrecio('Detal $15\nMayor $12,00')).toBe(1200);
    expect(leerPrecio('12,50 USD')).toBe(1250);
    expect(leerPrecio('Tallas 28 al 40')).toBeNull();
  });
  it('detecta la forma y los colores', () => {
    expect(leerForma('Chemise piqué manga corta')).toBe('chemise');
    expect(leerForma('Pantalón drill 6 bolsillos')).toBe('pantalon');
    expect(leerForma('Gorra trucker')).toBe('gorra');
    expect(leerColores('Disponible en negro, azul marino y blanco').map((c) => c.nombre)).toEqual([
      'Negro',
      'Azul marino',
      'Blanco',
    ]);
  });
});

describe('bloque de producto', () => {
  it('separa nombre, código, descripción y precio', () => {
    const d = interpretarBloque([
      'Chemise piqué manga corta',
      'Código: UNI-101',
      'Chemise tipo polo en piqué 100% algodón, cuello tejido, tallas S a XXL. Color azul marino.',
      'Precio mayor: $12.50',
    ]);
    expect(d.codigo).toBe('UNI-101');
    expect(d.nombre).toBe('Chemise piqué manga corta');
    expect(d.descripcion).toContain('100% algodón');
    expect(d.precioCentavos).toBe(1250);
    expect(d.tallas).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
    expect(d.forma).toBe('chemise');
    expect(d.colores[0].nombre).toBe('Azul marino');
  });
  it('deja vacío lo que no está', () => {
    const d = interpretarBloque(['Chaqueta corporativa']);
    expect(d.codigo).toBeNull();
    expect(d.precioCentavos).toBeNull();
    expect(d.tallas).toBeNull();
  });
});
