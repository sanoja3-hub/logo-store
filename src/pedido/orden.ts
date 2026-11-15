// Textos del pedido: número de orden, cotización con las reglas, mensaje de WhatsApp y CSV para el asesor.

import { formatoDinero } from '../core/dinero';
import { ordenarTallas } from '../core/interpretar';
import type { Ajustes, Cliente, LineaPedido, LogoCliente, Sucursal, Vendedor } from '../core/modelo';
import { NIVELES, POSICIONES, TAMANOS, cotizar, totalUnidadesDe, type Cotizacion, type Reglas } from '../core/reglas';

export function numeroOrden(fecha = new Date()): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${fecha.getFullYear().toString().slice(2)}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}-${sufijo}`;
}

export interface CotizacionPedido {
  lineas: Map<string, Cotizacion>;
  unidades: number;
  montoCentavos: number;
  /** true si todas las líneas tienen precio; si no, el monto es parcial. */
  completo: boolean;
  /** Personalizaciones que no se pueden aplicar, con su motivo. */
  errores: string[];
}

export function cotizarPedido(lineas: LineaPedido[], reglas: Reglas): CotizacionPedido {
  const unidades = lineas.reduce((a, l) => a + totalUnidadesDe(l.cantidades), 0);
  const mapa = new Map<string, Cotizacion>();
  let monto = 0;
  let completo = true;
  const errores: string[] = [];
  for (const l of lineas) {
    const c = cotizar(l, reglas, unidades);
    mapa.set(l.id, c);
    if (c.subtotal === null) completo = false;
    else monto += c.subtotal;
    for (const e of c.errores) errores.push(`${l.codigo || l.nombre}: ${e}`);
  }
  return { lineas: mapa, unidades, montoCentavos: monto, completo, errores };
}

export function tallasDelPedido(lineas: LineaPedido[]): string[] {
  return ordenarTallas(lineas.flatMap((l) => Object.keys(l.cantidades)));
}

/** Curva de tallas: «S: 5 | M: 10 | L: 5». */
export function detalleTallas(l: Pick<LineaPedido, 'cantidades'>): string {
  return ordenarTallas(Object.keys(l.cantidades))
    .filter((t) => l.cantidades[t] > 0)
    .map((t) => `${t}: ${l.cantidades[t]}`)
    .join(' | ');
}

export const etiquetaNivel = (n: Cotizacion['nivel']) => NIVELES.find((x) => x.valor === n)?.etiqueta ?? n;
export const etiquetaTamano = (t: string) => TAMANOS.find((x) => x.valor === t)?.etiqueta ?? t;

/** «Pecho izquierdo · Bordado · Pequeño» */
export function textoPersonalizacion(p: Cotizacion['personalizaciones'][number]): string {
  return `${POSICIONES[p.posicion]} · ${p.tecnicaNombre} · ${etiquetaTamano(p.tamano)}`;
}

export function mensajeWhatsApp(
  numero: string,
  lineas: LineaPedido[],
  cliente: Cliente,
  logo: LogoCliente | null,
  ajustes: Ajustes,
  reglas: Reglas,
  atencion?: { sucursal: Sucursal | null; vendedor: Vendedor | null },
): string {
  const cot = cotizarPedido(lineas, reglas);
  const $ = (c: number | null) => (c === null ? 'por confirmar' : formatoDinero(c, ajustes.moneda));
  const precios = ajustes.mostrarPrecios;
  const partes: string[] = [];
  partes.push(`*Orden de pedido ${numero}*`);
  if (atencion?.sucursal || atencion?.vendedor) {
    partes.push(`Atiende: ${[atencion.vendedor?.nombre, atencion.sucursal?.nombre].filter(Boolean).join(' · ')}`);
  }
  partes.push(`Cliente: ${cliente.empresa}${cliente.rif ? ` (RIF/Doc. ${cliente.rif})` : ''}`);
  partes.push(`Teléfono: ${cliente.telefono}${cliente.contacto ? ` · ${cliente.contacto}` : ''}${cliente.correo ? ` · ${cliente.correo}` : ''}`);
  if (cliente.ciudad) partes.push(`Entrega en: ${cliente.ciudad}`);
  partes.push('');
  lineas.forEach((l, i) => {
    const c = cot.lineas.get(l.id)!;
    partes.push(`*${i + 1}) ${l.codigo || 'Sin código'} · ${l.nombre}*${l.color ? ` · ${l.color.nombre}` : ''}`);
    partes.push(`   Tallas: ${detalleTallas(l)} = ${c.unidades} uds`);
    if (precios) {
      partes.push(`   Prenda (precio ${etiquetaNivel(c.nivel).toLowerCase()}):`);
      for (const t of c.tallas) partes.push(`     ${t.talla}: ${t.cantidad} × ${$(t.precioUnitario)} = ${$(t.subtotal)}`);
    }
    for (const p of c.personalizaciones) {
      if (p.error) partes.push(`   ✗ ${textoPersonalizacion(p)}: ${p.error}`);
      else
        partes.push(
          `   + ${textoPersonalizacion(p)}${precios ? `: ${$(p.precioUnitario)} c/u${p.descuento ? ` (-${p.descuento}%)` : ''} = ${$(p.subtotal)}` : ''}`,
        );
    }
    if (l.nota) partes.push(`   Nota: ${l.nota}`);
    if (precios) partes.push(`   Subtotal: ${$(c.subtotal)}`);
    partes.push('');
  });
  let total = `*Total: ${cot.unidades} unidades*`;
  if (precios && cot.montoCentavos > 0) total += ` · *${$(cot.montoCentavos)}*${cot.completo ? '' : ' (sin los artículos por confirmar)'}`;
  partes.push(total);
  if (precios) partes.push('Precios referenciales: el asesor confirma la orden antes de producir.');
  const conLogo = lineas.some((l) => l.personalizaciones.length > 0);
  if (conLogo) {
    partes.push(
      logo
        ? `Logo: ${logo.nombreArchivo}. Lo adjunto en este chat junto con la orden.`
        : 'Logo: lo envío en este chat.',
    );
  }
  if (cliente.notas) partes.push(`Notas: ${cliente.notas}`);
  return partes.join('\n');
}

export function enlaceWhatsApp(numero: string, texto: string): string {
  // Sin número configurado, WhatsApp deja elegir el contacto.
  const tel = numero.replace(/\D/g, '');
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

/** Campos del cliente que faltan para poder enviar la orden. */
export function faltantesCliente(c: Cliente): string[] {
  const f: string[] = [];
  if (!c.empresa.trim()) f.push('nombre o empresa');
  if (c.telefono.replace(/\D/g, '').length < 7) f.push('teléfono');
  return f;
}

const celdaCsv = (v: string | number) => {
  const t = String(v);
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/**
 * Orden en CSV (separado por punto y coma, como lo abre Excel en español): una fila por talla y otra por cada
 * personalización, con sus montos en números.
 */
export function csvPedido(numero: string, lineas: LineaPedido[], cliente: Cliente, ajustes: Ajustes, reglas: Reglas): string {
  const cot = cotizarPedido(lineas, reglas);
  const n = (c: number | null) => (c === null || !ajustes.mostrarPrecios ? '' : (c / 100).toFixed(2).replace('.', ','));
  const filas: (string | number)[][] = [
    ['Orden', numero],
    ['Cliente', cliente.empresa],
    ['RIF/Documento', cliente.rif],
    ['Teléfono', cliente.telefono],
    ['Notas', cliente.notas],
    [],
    ['Ítem', 'Código', 'Artículo', 'Color', 'Concepto', 'Talla', 'Cantidad', `Precio unitario (${ajustes.moneda})`, `Subtotal (${ajustes.moneda})`],
  ];
  lineas.forEach((l, i) => {
    const c = cot.lineas.get(l.id)!;
    const base = [i + 1, l.codigo, l.nombre, l.color?.nombre ?? ''];
    for (const t of c.tallas) filas.push([...base, `Prenda (${etiquetaNivel(c.nivel)})`, t.talla, t.cantidad, n(t.precioUnitario), n(t.subtotal)]);
    for (const p of c.personalizaciones) {
      filas.push([...base, p.error ? `${textoPersonalizacion(p)} (no aplicable: ${p.error})` : textoPersonalizacion(p), '', c.unidades, n(p.precioUnitario), n(p.subtotal)]);
    }
    if (l.nota) filas.push([...base, `Nota: ${l.nota}`, '', '', '', '']);
    filas.push([...base, 'Subtotal del ítem', '', c.unidades, '', n(c.subtotal)]);
  });
  filas.push([]);
  filas.push(['', '', '', '', 'TOTAL', '', cot.unidades, '', n(cot.montoCentavos)]);
  return '﻿' + filas.map((f) => f.map(celdaCsv).join(';')).join('\r\n');
}
