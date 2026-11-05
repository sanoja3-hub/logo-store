// Dinero en centavos enteros: nunca se suman montos con decimales.

/** Convierte un texto o número de precio a centavos. Acepta "12,50", "12.50", "1.234,50", "1,234.50", "$ 12". */
export function aCentavos(valor: unknown): number | null {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : null;
  }
  if (typeof valor !== 'string') return null;
  let t = valor.replace(/[^\d.,]/g, '');
  if (!t || !/\d/.test(t)) return null;
  const ultimaComa = t.lastIndexOf(',');
  const ultimoPunto = t.lastIndexOf('.');
  const sep = Math.max(ultimaComa, ultimoPunto);
  if (sep >= 0 && t.length - sep - 1 <= 2) {
    // El último separador es decimal.
    const entero = t.slice(0, sep).replace(/[.,]/g, '');
    const dec = t.slice(sep + 1).padEnd(2, '0');
    t = `${entero || '0'}.${dec}`;
  } else {
    t = t.replace(/[.,]/g, '');
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export function formatoDinero(centavos: number, moneda = 'USD'): string {
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const entero = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = (abs % 100).toString().padStart(2, '0');
  const simbolo = moneda === 'USD' ? '$' : moneda === 'EUR' ? '€' : moneda === 'VES' ? 'Bs.' : moneda;
  return `${signo}${simbolo} ${entero},${dec}`;
}
