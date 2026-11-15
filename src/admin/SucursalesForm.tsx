// Panel → Sucursales: las tiendas del grupo y sus vendedores. Cada vendedor comparte su propio enlace del
// catálogo y los pedidos de esos clientes le llegan a su WhatsApp. No hay usuarios ni contraseñas.

import { useState } from 'react';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { nuevoId, type Sucursal, type Vendedor } from '../core/modelo';
import { Boton } from '../ui/comunes';

const entrada = 'foco h-9 w-full rounded-lg border border-tinta-200 bg-white px-2 text-sm';

export function enlaceVendedor(v: Pick<Vendedor, 'id'>): string {
  const u = new URL(window.location.href);
  u.search = `?vendedor=${encodeURIComponent(v.id)}`;
  u.hash = 'catalogo';
  return u.toString();
}

export function SucursalesForm({ sucursales, onCambio }: { sucursales: Sucursal[]; onCambio: (s: Sucursal[]) => void }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const cambiarSucursal = (id: string, c: Partial<Sucursal>) => onCambio(sucursales.map((s) => (s.id === id ? { ...s, ...c } : s)));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 text-sm text-tinta-600 ring-1 ring-tinta-200">
        Cada vendedor tiene su enlace del catálogo: el cliente que entra por ese enlace le envía el pedido directo a su WhatsApp. Si el
        cliente entra por el enlace general, elige la sucursal y el vendedor al enviar. Las sucursales comparten el mismo catálogo, los
        precios y el stock que se publican desde aquí.
      </div>
      {sucursales.map((s) => (
        <section key={s.id} className="rounded-2xl bg-white p-5 ring-1 ring-tinta-200">
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-tinta-600">Sucursal</span>
              <input value={s.nombre} onChange={(e) => cambiarSucursal(s.id, { nombre: e.target.value })} className={entrada} />
            </label>
            <Boton
              variante="peligro"
              tamano="sm"
              className="h-9"
              onClick={() => {
                if (confirm(`¿Quitar la sucursal «${s.nombre}» y sus vendedores?`)) onCambio(sucursales.filter((x) => x.id !== s.id));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Boton>
          </div>
          <div className="mt-4 space-y-2">
            {s.vendedores.map((v) => {
              const cambiar = (c: Partial<Vendedor>) => cambiarSucursal(s.id, { vendedores: s.vendedores.map((x) => (x.id === v.id ? { ...x, ...c } : x)) });
              return (
                <div key={v.id} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-tinta-500">Vendedor</span>
                    <input value={v.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} className={entrada} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-tinta-500">WhatsApp (con código de país)</span>
                    <input
                      value={v.whatsapp}
                      inputMode="tel"
                      placeholder="584141234567"
                      onChange={(e) => cambiar({ whatsapp: e.target.value.replace(/[^\d]/g, '') })}
                      className={`${entrada} ${v.whatsapp.length > 0 && v.whatsapp.length < 10 ? 'border-amber-400' : ''}`}
                    />
                  </label>
                  <Boton
                    variante="secundario"
                    tamano="sm"
                    className="h-9"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(enlaceVendedor(v));
                        setCopiado(v.id);
                        setTimeout(() => setCopiado(null), 2000);
                      } catch {
                        prompt('Copia el enlace del vendedor:', enlaceVendedor(v));
                      }
                    }}
                  >
                    {copiado === v.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado === v.id ? 'Copiado' : 'Copiar enlace'}
                  </Boton>
                  <button
                    onClick={() => cambiarSucursal(s.id, { vendedores: s.vendedores.filter((x) => x.id !== v.id) })}
                    className="foco mb-1.5 rounded p-1.5 text-tinta-400 hover:text-red-600"
                    aria-label={`Quitar a ${v.nombre}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            <Boton
              variante="secundario"
              tamano="sm"
              onClick={() => cambiarSucursal(s.id, { vendedores: [...s.vendedores, { id: nuevoId('ven'), nombre: 'Vendedor nuevo', whatsapp: '' }] })}
            >
              <Plus className="h-4 w-4" /> Agregar vendedor
            </Boton>
          </div>
        </section>
      ))}
      <Boton variante="secundario" onClick={() => onCambio([...sucursales, { id: nuevoId('suc'), nombre: 'Sucursal nueva', vendedores: [] }])}>
        <Plus className="h-4 w-4" /> Agregar sucursal
      </Boton>
    </div>
  );
}
