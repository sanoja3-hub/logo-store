// Panel → Precios y reglas: tarifario de personalización, escalas por volumen, niveles de precio, tallas grandes
// y compatibilidad de técnicas con telas y de tamaños con posiciones.

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { aCentavos, formatoDinero } from '../core/dinero';
import { POSICIONES, REGLAS_INICIALES, TAMANOS, type Posicion, type Reglas, type Tamano } from '../core/reglas';
import { Boton } from '../ui/comunes';

const entrada = 'foco h-9 w-full rounded-lg border border-tinta-200 bg-white px-2 text-sm';

/** Campo de dinero: se escribe como texto ("12,50") y se guarda en centavos al salir. */
export function CampoPrecio({
  valor,
  onCambio,
  placeholder = '—',
  className = '',
  etiqueta,
}: {
  valor: number | null | undefined;
  onCambio: (c: number | null) => void;
  placeholder?: string;
  className?: string;
  etiqueta?: string;
}) {
  const aTexto = (v: number | null | undefined) => (v === null || v === undefined ? '' : (v / 100).toFixed(2).replace('.', ','));
  const [texto, setTexto] = useState(aTexto(valor));
  const [previo, setPrevio] = useState(valor);
  if (previo !== valor) {
    setPrevio(valor);
    setTexto(aTexto(valor));
  }
  return (
    <input
      value={texto}
      inputMode="decimal"
      aria-label={etiqueta}
      placeholder={placeholder}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        const c = texto.trim() ? aCentavos(texto) : null;
        onCambio(c);
        setTexto(aTexto(c));
      }}
      className={`${entrada} text-right tabular-nums ${className}`}
    />
  );
}

function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-tinta-200">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {ayuda && <p className="mt-0.5 text-sm text-tinta-500">{ayuda}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ReglasForm({ reglas: r, moneda, onCambio }: { reglas: Reglas; moneda: string; onCambio: (r: Reglas) => void }) {
  const [nuevaTela, setNuevaTela] = useState('');
  const posiciones = Object.keys(POSICIONES) as Posicion[];
  const set = <K extends keyof Reglas>(k: K, v: Reglas[K]) => onCambio({ ...r, [k]: v });

  return (
    <div className="space-y-5">
      <Seccion titulo="Precio de la prenda según la cantidad" ayuda="Cada artículo tiene tres precios (detal, mayor y distribuidor); se editan en «Revisar». Aquí se decide desde cuántas unidades aplica cada uno.">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-tinta-600">Precio mayor desde (uds)</span>
            <input type="number" min={2} value={r.niveles.mayorDesde} onChange={(e) => set('niveles', { ...r.niveles, mayorDesde: Math.max(2, Number(e.target.value) || 2) })} className={entrada} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-tinta-600">Precio distribuidor desde (uds)</span>
            <input
              type="number"
              min={r.niveles.mayorDesde + 1}
              value={r.niveles.distribuidorDesde}
              onChange={(e) => set('niveles', { ...r.niveles, distribuidorDesde: Math.max(r.niveles.mayorDesde + 1, Number(e.target.value) || 0) })}
              className={entrada}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-tinta-600">Se cuentan las unidades de…</span>
            <select value={r.conteo} onChange={(e) => set('conteo', e.target.value as Reglas['conteo'])} className={entrada}>
              <option value="articulo">Cada artículo por separado</option>
              <option value="pedido">Todo el pedido junto</option>
            </select>
          </label>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-tinta-600">Tallas grandes</span>
            <input
              defaultValue={r.tallasGrandes.tallas.join(', ')}
              onBlur={(e) =>
                set('tallasGrandes', {
                  ...r.tallasGrandes,
                  tallas: e.target.value
                    .split(/[,;\s]+/)
                    .map((x) => x.trim().toUpperCase())
                    .filter(Boolean),
                })
              }
              className={entrada}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-tinta-600">Recargo de las tallas grandes</span>
            <select
              value={r.tallasGrandes.tipo}
              onChange={(e) => set('tallasGrandes', { ...r.tallasGrandes, tipo: e.target.value as 'porcentaje' | 'monto', valor: 0 })}
              className={entrada}
            >
              <option value="porcentaje">Porcentaje sobre el precio</option>
              <option value="monto">Monto fijo por unidad</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-tinta-600">{r.tallasGrandes.tipo === 'porcentaje' ? 'Porcentaje (%)' : `Monto (${moneda})`}</span>
            {r.tallasGrandes.tipo === 'porcentaje' ? (
              <input
                type="number"
                min={0}
                value={r.tallasGrandes.valor}
                onChange={(e) => set('tallasGrandes', { ...r.tallasGrandes, valor: Math.max(0, Number(e.target.value) || 0) })}
                className={entrada}
              />
            ) : (
              <CampoPrecio valor={r.tallasGrandes.valor} onCambio={(c) => set('tallasGrandes', { ...r.tallasGrandes, valor: c ?? 0 })} />
            )}
          </label>
        </div>
        <p className="mt-2 text-xs text-tinta-500">Si un artículo tiene precio propio para tallas grandes (en «Revisar»), ese gana al recargo.</p>
      </Seccion>

      <Seccion titulo="Tarifario de personalización" ayuda="Precio por prenda y por posición, según la técnica y el tamaño. Un tamaño vacío no se ofrece con esa técnica.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-tinta-500">
                <th className="pb-2 pr-2 font-medium">Activa</th>
                <th className="pb-2 pr-2 font-medium">Técnica</th>
                {TAMANOS.map((t) => (
                  <th key={t.valor} className="pb-2 pr-2 text-right font-medium">
                    {t.etiqueta}
                    <span className="block font-normal text-tinta-400">hasta {t.cm} cm</span>
                  </th>
                ))}
                <th className="pb-2 font-medium">Mínimo (uds)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tinta-100">
              {r.tecnicas.map((t, i) => {
                const cambiar = (c: Partial<typeof t>) => set('tecnicas', r.tecnicas.map((x, k) => (k === i ? { ...x, ...c } : x)));
                return (
                  <tr key={t.id} className={t.activa ? '' : 'opacity-50'}>
                    <td className="py-2 pr-2">
                      <input type="checkbox" checked={t.activa} onChange={(e) => cambiar({ activa: e.target.checked })} className="h-4 w-4 accent-tinta-900" />
                    </td>
                    <td className="py-2 pr-2">
                      <input value={t.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} className={entrada} />
                    </td>
                    {TAMANOS.map((tm) => (
                      <td key={tm.valor} className="py-2 pr-2">
                        <CampoPrecio
                          valor={t.precios[tm.valor]}
                          etiqueta={`${t.nombre} ${tm.etiqueta}`}
                          onCambio={(c) => cambiar({ precios: { ...t.precios, [tm.valor]: c } })}
                        />
                      </td>
                    ))}
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        value={t.minimo || ''}
                        placeholder="Sin mínimo"
                        onChange={(e) => cambiar({ minimo: Math.max(0, Number(e.target.value) || 0) })}
                        className={entrada}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Descuento en la personalización por volumen" ayuda="Se aplica sobre el tarifario según las unidades. Cada escala vale desde su cantidad hasta la siguiente.">
        <div className="space-y-2">
          {[...r.escalas]
            .sort((a, b) => a.desde - b.desde)
            .map((e, i, lista) => {
              const siguiente = lista[i + 1];
              const cambiar = (c: Partial<typeof e>) => set('escalas', lista.map((x, k) => (k === i ? { ...x, ...c } : x)));
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] items-center gap-2 text-sm">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-tinta-500">Desde (uds)</span>
                    <input type="number" min={1} value={e.desde} onChange={(ev) => cambiar({ desde: Math.max(1, Number(ev.target.value) || 1) })} className={entrada} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-tinta-500">Descuento (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={e.descuento}
                      onChange={(ev) => cambiar({ descuento: Math.min(100, Math.max(0, Number(ev.target.value) || 0)) })}
                      className={entrada}
                    />
                  </label>
                  <span className="pt-5 text-xs text-tinta-500">
                    {siguiente ? `de ${e.desde} a ${siguiente.desde - 1} uds` : `${e.desde} uds o más`} ·{' '}
                    {e.descuento ? `-${e.descuento} %` : '100 % del precio'}
                  </span>
                  <button
                    onClick={() => set('escalas', lista.filter((_, k) => k !== i))}
                    className="foco mt-5 rounded p-1.5 text-tinta-400 hover:text-red-600"
                    aria-label="Quitar escala"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => set('escalas', [...r.escalas, { desde: Math.max(1, ...r.escalas.map((e) => e.desde)) + 50, descuento: 0 }])}
          >
            <Plus className="h-4 w-4" /> Agregar escala
          </Boton>
        </div>
      </Seccion>

      <Seccion titulo="Técnicas permitidas por tela" ayuda="Desmarca lo que no se puede hacer en esa tela (por ejemplo, sublimado en algodón). Al cliente no le aparece.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-tinta-500">
                <th className="pb-2 pr-2 font-medium">Tela</th>
                {r.tecnicas.map((t) => (
                  <th key={t.id} className="pb-2 pr-2 text-center font-medium">
                    {t.nombre}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-tinta-100">
              {r.telas.map((tela) => {
                const permitidas = r.telaTecnicas[tela] ?? r.tecnicas.map((t) => t.id);
                return (
                  <tr key={tela}>
                    <td className="py-2 pr-2 font-medium">{tela}</td>
                    {r.tecnicas.map((t) => (
                      <td key={t.id} className="py-2 pr-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${t.nombre} en ${tela}`}
                          checked={permitidas.includes(t.id)}
                          onChange={(e) =>
                            set('telaTecnicas', {
                              ...r.telaTecnicas,
                              [tela]: e.target.checked ? [...permitidas, t.id] : permitidas.filter((x) => x !== t.id),
                            })
                          }
                          className="h-4 w-4 accent-tinta-900"
                        />
                      </td>
                    ))}
                    <td className="py-2 text-right">
                      <button
                        onClick={() => {
                          const resto = { ...r.telaTecnicas };
                          delete resto[tela];
                          onCambio({ ...r, telas: r.telas.filter((x) => x !== tela), telaTecnicas: resto });
                        }}
                        className="foco rounded p-1 text-tinta-400 hover:text-red-600"
                        aria-label={`Quitar ${tela}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex max-w-sm gap-2">
          <input value={nuevaTela} onChange={(e) => setNuevaTela(e.target.value)} placeholder="Nueva tela" className={entrada} />
          <Boton
            variante="secundario"
            tamano="sm"
            className="h-9"
            disabled={!nuevaTela.trim() || r.telas.includes(nuevaTela.trim())}
            onClick={() => {
              set('telas', [...r.telas, nuevaTela.trim()]);
              setNuevaTela('');
            }}
          >
            <Plus className="h-4 w-4" /> Agregar
          </Boton>
        </div>
      </Seccion>

      <Seccion titulo="Tamaños permitidos por posición" ayuda="Por ejemplo, bloquear el tamaño grande en las mangas.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs text-tinta-500">
                <th className="pb-2 pr-2 font-medium">Posición</th>
                {TAMANOS.map((t) => (
                  <th key={t.valor} className="pb-2 pr-2 text-center font-medium">
                    {t.etiqueta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-tinta-100">
              {posiciones.map((pos) => {
                const permitidos: Tamano[] = r.posicionTamanos[pos] ?? TAMANOS.map((t) => t.valor);
                return (
                  <tr key={pos}>
                    <td className="py-2 pr-2">{POSICIONES[pos]}</td>
                    {TAMANOS.map((t) => (
                      <td key={t.valor} className="py-2 pr-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${t.etiqueta} en ${POSICIONES[pos]}`}
                          checked={permitidos.includes(t.valor)}
                          onChange={(e) =>
                            set('posicionTamanos', {
                              ...r.posicionTamanos,
                              [pos]: e.target.checked ? [...permitidos, t.valor] : permitidos.filter((x) => x !== t.valor),
                            })
                          }
                          className="h-4 w-4 accent-tinta-900"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Seccion>

      <div className="flex items-center justify-between text-xs text-tinta-500">
        <span>Ejemplo: bordado pequeño {formatoDinero(r.tecnicas[0]?.precios.pequeno ?? 0, moneda)} por prenda antes del descuento.</span>
        <Boton
          variante="peligro"
          tamano="sm"
          onClick={() => {
            if (confirm('¿Volver a las reglas de ejemplo? Se pierden los cambios de esta pantalla.')) onCambio(structuredClone(REGLAS_INICIALES));
          }}
        >
          Restaurar reglas de ejemplo
        </Boton>
      </div>
    </div>
  );
}
