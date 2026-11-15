import { describe, expect, it } from 'vitest';
import {
  REGLAS_INICIALES,
  cotizar,
  escalaPorCantidad,
  nivelPorCantidad,
  precioTalla,
  tamanosPermitidos,
  tecnicasPermitidas,
  type LineaCotizable,
  type Reglas,
} from './reglas';

const r: Reglas = structuredClone(REGLAS_INICIALES);
const precios = { detal: 2800, mayor: 2200, distribuidor: 1800 };
const linea = (cantidades: Record<string, number>, extra: Partial<LineaCotizable> = {}): LineaCotizable => ({
  cantidades,
  precios,
  tela: 'Algodón/Poliéster',
  personalizaciones: [],
  ...extra,
});

describe('nivel de precio por cantidad', () => {
  it('detal, mayor y distribuidor según las unidades', () => {
    expect(nivelPorCantidad(11, r)).toBe('detal');
    expect(nivelPorCantidad(12, r)).toBe('mayor');
    expect(nivelPorCantidad(99, r)).toBe('mayor');
    expect(nivelPorCantidad(100, r)).toBe('distribuidor');
  });

  it('cotiza la prenda al nivel que corresponde', () => {
    expect(cotizar(linea({ M: 5 }), r).prendaSubtotal).toBe(5 * 2800);
    expect(cotizar(linea({ S: 6, M: 6 }), r).prendaSubtotal).toBe(12 * 2200);
    expect(cotizar(linea({ M: 100 }), r).nivel).toBe('distribuidor');
  });

  it('puede contar las unidades de todo el pedido', () => {
    const porPedido = { ...r, conteo: 'pedido' as const };
    const c = cotizar(linea({ M: 5 }), porPedido, 40);
    expect(c.nivel).toBe('mayor');
    expect(c.prendaSubtotal).toBe(5 * 2200);
  });

  it('si falta el precio del nivel usa el anterior', () => {
    const c = cotizar(linea({ M: 120 }, { precios: { detal: 2800, mayor: 2200, distribuidor: null } }), r);
    expect(c.tallas[0].precioUnitario).toBe(2200);
  });
});

describe('tallas grandes', () => {
  it('aplica el recargo de las reglas desde 2XL', () => {
    expect(precioTalla('XL', 'detal', precios, undefined, r)).toBe(2800);
    expect(precioTalla('2XL', 'detal', precios, undefined, r)).toBe(3220);
    expect(precioTalla('xxl', 'mayor', precios, undefined, r)).toBe(2530);
  });

  it('puede ser un monto fijo', () => {
    const fijo = { ...r, tallasGrandes: { ...r.tallasGrandes, tipo: 'monto' as const, valor: 300 } };
    expect(precioTalla('3XL', 'distribuidor', precios, undefined, fijo)).toBe(2100);
  });

  it('el precio propio del artículo gana al recargo', () => {
    expect(precioTalla('4XL', 'mayor', precios, { detal: 3300, mayor: 2600 }, r)).toBe(2600);
  });

  it('suma tallas normales y grandes por separado', () => {
    const c = cotizar(linea({ M: 10, '2XL': 2 }), r);
    expect(c.nivel).toBe('mayor');
    expect(c.prendaSubtotal).toBe(10 * 2200 + 2 * 2530);
    expect(c.tallas.find((t) => t.talla === '2XL')?.grande).toBe(true);
  });
});

describe('personalización', () => {
  const pers = (posicion: 'pecho_izquierdo' | 'espalda_central' | 'manga_derecha', tecnica: string, tamano: 'pequeno' | 'mediano' | 'grande') => ({
    id: `${posicion}-${tecnica}`,
    posicion,
    tecnica,
    tamano,
  });

  it('suma cada posición con el descuento por volumen', () => {
    expect(escalaPorCantidad(5, r).descuento).toBe(0);
    expect(escalaPorCantidad(12, r).descuento).toBe(15);
    expect(escalaPorCantidad(60, r).descuento).toBe(30);
    const c = cotizar(
      linea({ M: 20 }, { personalizaciones: [pers('pecho_izquierdo', 'bordado', 'pequeno'), pers('espalda_central', 'dtf', 'grande')] }),
      r,
    );
    // Bordado pequeño 3,50 y DTF grande 7,00 con 15 % de descuento.
    expect(c.personalizaciones.map((p) => p.precioUnitario)).toEqual([298, 595]);
    expect(c.personalizacionUnitaria).toBe(893);
    expect(c.personalizacionSubtotal).toBe(893 * 20);
    expect(c.subtotal).toBe(20 * 2200 + 893 * 20);
    expect(c.errores).toEqual([]);
  });

  it('filtra técnicas por tela y tamaños por posición', () => {
    expect(tecnicasPermitidas('Algodón 100%', r).map((t) => t.id)).not.toContain('sublimado');
    expect(tecnicasPermitidas('Poliéster', r).map((t) => t.id)).toContain('sublimado');
    expect(tecnicasPermitidas('Tela nueva', r).length).toBe(5);
    const bordado = r.tecnicas.find((t) => t.id === 'bordado');
    expect(tamanosPermitidos('manga_derecha', bordado, r)).toEqual(['pequeno']);
  });

  it('no cobra lo que no se puede aplicar y dice por qué', () => {
    const c = cotizar(
      linea({ M: 5 }, {
        tela: 'Algodón 100%',
        personalizaciones: [pers('pecho_izquierdo', 'sublimado', 'pequeno'), pers('manga_derecha', 'bordado', 'grande'), pers('espalda_central', 'serigrafia', 'grande')],
      }),
      r,
    );
    expect(c.personalizacionUnitaria).toBe(0);
    expect(c.errores).toHaveLength(3);
    expect(c.errores[0]).toContain('no se puede aplicar en Algodón 100%');
    expect(c.errores[1]).toContain('no permitido en manga derecha');
    expect(c.errores[2]).toContain('exige mínimo 12 unidades');
  });
});
