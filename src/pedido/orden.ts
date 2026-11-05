// Textos del pedido: número de orden, totales y mensaje de WhatsApp para el asesor.

import { formatoDinero } from '../core/dinero';
import { ordenarTallas } from '../core/interpretar';
import { UBICACIONES, totalUnidades, type Ajustes, type Cliente, type LineaPedido, type LogoCliente } from '../core/modelo';

export function numeroOrden(fecha = new Date()): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${fecha.getFullYear().toString().slice(2)}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}-${sufijo}`;
}

export function subtotal(l: LineaPedido): number | null {
  return l.precioCentavos === null ? null : l.precioCentavos * totalUnidades(l);
}

export interface Totales {
  unidades: number;
  montoCentavos: number;
  /** true si todas las líneas tienen precio; si no, el monto es parcial. */
  completo: boolean;
}

export function totales(lineas: LineaPedido[]): Totales {
  let unidades = 0;
  let monto = 0;
  let completo = true;
  for (const l of lineas) {
    unidades += totalUnidades(l);
    const s = subtotal(l);
    if (s === null) completo = false;
    else monto += s;
  }
  return { unidades, montoCentavos: monto, completo };
}

export function tallasDelPedido(lineas: LineaPedido[]): string[] {
  return ordenarTallas(lineas.flatMap((l) => Object.keys(l.cantidades)));
}

export function detalleTallas(l: LineaPedido): string {
  return Object.entries(l.cantidades)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${t}: ${n}`)
    .join(' · ');
}

export function textoLogo(l: LineaPedido): string {
  return l.ubicacion === 'sin_logo' ? 'Sin logo' : `${l.tecnica}, ${UBICACIONES[l.ubicacion].toLowerCase()}`;
}

export function mensajeWhatsApp(
  numero: string,
  lineas: LineaPedido[],
  cliente: Cliente,
  logo: LogoCliente | null,
  ajustes: Ajustes,
): string {
  const t = totales(lineas);
  const partes: string[] = [];
  partes.push(`*Orden de pedido ${numero}*`);
  partes.push(`Empresa: ${cliente.empresa}${cliente.rif ? ` (RIF ${cliente.rif})` : ''}`);
  partes.push(`Contacto: ${cliente.contacto} · ${cliente.telefono}${cliente.correo ? ` · ${cliente.correo}` : ''}`);
  if (cliente.ciudad) partes.push(`Entrega en: ${cliente.ciudad}`);
  partes.push('');
  lineas.forEach((l, i) => {
    partes.push(`${i + 1}) *${l.codigo || 'Sin código'}* ${l.nombre}${l.color ? ` · ${l.color.nombre}` : ''}`);
    partes.push(`   ${detalleTallas(l)} = ${totalUnidades(l)} uds`);
    partes.push(`   Logo: ${textoLogo(l)}`);
    if (l.nota) partes.push(`   Nota: ${l.nota}`);
  });
  partes.push('');
  let total = `Total: ${t.unidades} unidades`;
  if (ajustes.mostrarPrecios && t.montoCentavos > 0) {
    total += ` · ${formatoDinero(t.montoCentavos, ajustes.moneda)}${t.completo ? '' : ' (sin incluir artículos sin precio)'} referencial`;
  }
  partes.push(total);
  partes.push(logo ? `Logo de la empresa: ${logo.nombreArchivo} (${logo.ancho}×${logo.alto} px), va adjunto con la orden en PDF.` : 'El cliente no adjuntó logo.');
  if (cliente.notas) partes.push(`Notas: ${cliente.notas}`);
  return partes.join('\n');
}

export function enlaceWhatsApp(numeroAsesor: string, texto: string): string {
  const tel = numeroAsesor.replace(/\D/g, '');
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

/** Campos del cliente que faltan para poder enviar la orden. */
export function faltantesCliente(c: Cliente): string[] {
  const f: string[] = [];
  if (!c.empresa.trim()) f.push('empresa');
  if (!c.contacto.trim()) f.push('persona de contacto');
  if (c.telefono.replace(/\D/g, '').length < 7) f.push('teléfono');
  return f;
}
