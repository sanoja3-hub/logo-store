import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ImagePlus, Search, Settings, ShoppingBag } from 'lucide-react';
import { ir } from '../ruta';
import { almacen, cargarCatalogoPublico } from '../core/almacen';
import { formatoDinero } from '../core/dinero';
import { CLIENTE_VACIO, type Catalogo, type Cliente, type LineaPedido, type LogoCliente, type Producto } from '../core/modelo';
import { totales } from '../pedido/orden';
import { Foto } from '../ui/comunes';
import { DetalleProducto } from './DetalleProducto';
import { PanelPedido } from './PanelPedido';

export function Tienda() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [fuente, setFuente] = useState<string>('');
  const [lineas, setLineas] = useState<LineaPedido[]>([]);
  const [cliente, setCliente] = useState<Cliente>(CLIENTE_VACIO);
  const [logo, setLogo] = useState<LogoCliente | null>(null);
  const [listo, setListo] = useState(false);
  const [categoria, setCategoria] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<{ producto: Producto; linea?: LineaPedido } | null>(null);
  const [pedidoAbierto, setPedidoAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ catalogo, fuente }, l, c, lg] = await Promise.all([
        cargarCatalogoPublico(),
        almacen.leerPedido(),
        almacen.leerCliente(),
        almacen.leerLogo(),
      ]);
      setCatalogo(catalogo);
      setFuente(fuente);
      if (l) setLineas(l);
      if (c) setCliente({ ...CLIENTE_VACIO, ...c });
      if (lg) setLogo(lg);
      setListo(true);
      document.title = `${catalogo.ajustes.empresa} · Showroom`;
    })();
  }, []);

  useEffect(() => {
    if (listo) void almacen.guardarPedido(lineas);
  }, [lineas, listo]);
  useEffect(() => {
    if (listo) void almacen.guardarCliente(cliente);
  }, [cliente, listo]);
  useEffect(() => {
    if (listo) void almacen.guardarLogo(logo);
  }, [logo, listo]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const categorias = useMemo(() => {
    const set = new Set(catalogo?.productos.map((p) => p.categoria) ?? []);
    return ['Todas', ...[...set].sort()];
  }, [catalogo]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (catalogo?.productos ?? []).filter(
      (p) =>
        (categoria === 'Todas' || p.categoria === categoria) &&
        (!q || `${p.codigo} ${p.nombre} ${p.descripcion}`.toLowerCase().includes(q)),
    );
  }, [catalogo, categoria, busqueda]);

  const guardarLinea = useCallback((l: LineaPedido) => {
    setLineas((prev) => {
      const i = prev.findIndex((x) => x.id === l.id);
      if (i >= 0) return prev.map((x) => (x.id === l.id ? l : x));
      return [...prev, l];
    });
  }, []);

  if (!catalogo) {
    return <div className="grid min-h-screen place-items-center text-sm text-tinta-500">Cargando catálogo…</div>;
  }
  const { ajustes } = catalogo;
  const t = totales(lineas);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-tinta-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tinta-900 text-sm font-bold tracking-tight text-white">
              {ajustes.empresa
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0])
                .join('')
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold leading-tight tracking-tight">{ajustes.empresa}</div>
              <div className="hidden truncate text-xs text-tinta-500 sm:block">{ajustes.lema}</div>
            </div>
          </div>
          <div className="mx-auto hidden max-w-md flex-1 md:block">
            <BuscadorCampo valor={busqueda} onCambio={setBusqueda} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => ir('admin')}
              title="Cargar o editar el catálogo"
              className="foco inline-flex h-10 items-center gap-2 rounded-lg border border-tinta-200 bg-white px-3 text-sm text-tinta-700 hover:border-tinta-300"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden lg:inline">Administrar catálogo</span>
            </button>
            <EtiquetaLogo logo={logo} onSubir={() => setPedidoAbierto(true)} />
            <button
              onClick={() => setPedidoAbierto(true)}
              className="foco relative inline-flex h-10 items-center gap-2 rounded-lg bg-tinta-900 px-3.5 text-sm font-medium text-white hover:bg-tinta-800 sm:px-4"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Mi pedido</span>
              {t.unidades > 0 && (
                <span className="rounded-full bg-acento-500 px-2 py-0.5 text-[11px] font-semibold text-tinta-950">{t.unidades}</span>
              )}
            </button>
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <BuscadorCampo valor={busqueda} onCambio={setBusqueda} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">
        <section className="mb-6 overflow-hidden rounded-2xl bg-tinta-900 text-white">
          <div className="grid gap-6 px-6 py-7 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-acento-100/80">Showroom mayorista</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Arma el pedido de uniformes de tu empresa</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-tinta-200">
                Mira cada prenda en 3D con tu logo, indica las cantidades por talla y envía la orden a tu asesor. Él la confirma
                contigo antes de producir.
              </p>
            </div>
            <ol className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-1">
              {['Elige los artículos y el color', 'Indica tallas, cantidades y tu logo', 'Envía la orden al asesor'].map((paso, i) => (
                <li key={paso} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-acento-500 text-xs font-semibold text-tinta-950">
                    {i + 1}
                  </span>
                  <span className="text-tinta-100">{paso}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {fuente === 'demo' && (
          <div className="mb-4 rounded-lg border border-acento-100 bg-acento-50 px-3 py-2 text-xs text-acento-600">
            {__DEMO_EJEMPLO__
              ? 'Demostración: los artículos, fotos y precios son de ejemplo. Para cargar tu catálogo usa el botón del engranaje (Administrar catálogo), arriba a la derecha.'
              : 'Vista previa del catálogo. Los precios que no trae el catálogo salen «por confirmar» y el asesor los indica al recibir la orden.'}
          </div>
        )}
        {fuente === 'local' && (
          <div className="mb-4 rounded-lg border border-acento-100 bg-acento-50 px-3 py-2 text-xs text-acento-600">
            Vista previa: estás viendo el catálogo publicado desde el panel en este navegador.
          </div>
        )}

        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setCategoria(c)}
                className={`foco h-9 shrink-0 rounded-full px-4 text-sm transition-colors ${
                  categoria === c ? 'bg-tinta-900 text-white' : 'bg-white text-tinta-600 ring-1 ring-tinta-200 hover:text-tinta-900'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="hidden shrink-0 text-xs text-tinta-500 sm:block">{visibles.length} artículos</div>
        </div>

        {catalogo.productos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-tinta-300 bg-white px-6 py-16 text-center">
            <div className="text-base font-semibold">El catálogo todavía está vacío</div>
            <p className="mx-auto mt-1 max-w-md text-sm text-tinta-500">
              Importa tu catálogo en PDF o Excel desde el panel de administración y publícalo.
            </p>
            <button onClick={() => ir('admin')} className="mt-4 inline-block text-sm font-medium text-tinta-900 underline">
              Ir al panel
            </button>
          </div>
        ) : visibles.length === 0 ? (
          <div className="py-16 text-center text-sm text-tinta-500">No hay artículos que coincidan con la búsqueda.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {visibles.map((p) => {
              const enPedido = lineas.filter((l) => l.productoId === p.id).length > 0;
              return (
                <button
                  key={p.id}
                  onClick={() => setAbierto({ producto: p })}
                  className="foco group flex flex-col overflow-hidden rounded-xl bg-white text-left ring-1 ring-tinta-200/80 transition hover:shadow-lg hover:ring-tinta-300"
                >
                  <div className="relative aspect-square overflow-hidden bg-white">
                    <Foto src={p.foto} alt={p.nombre} className="absolute inset-0 h-full w-full p-3 transition-transform duration-300 group-hover:scale-[1.03]" />
                    {enPedido && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        <Check className="h-3 w-3" /> En el pedido
                      </span>
                    )}
                    <span className="absolute bottom-2 right-2 rounded-md bg-tinta-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      Ver en 3D
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 border-t border-tinta-100 p-3">
                    <div className="font-mono text-[11px] text-tinta-500">{p.codigo || 'Sin código'}</div>
                    <div className="line-clamp-2 text-sm font-medium leading-snug text-tinta-900">{p.nombre || 'Artículo sin nombre'}</div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                      <div className="flex -space-x-1">
                        {p.colores.slice(0, 5).map((c) => (
                          <span key={c.nombre} title={c.nombre} className="h-4 w-4 rounded-full ring-2 ring-white" style={{ background: c.hex }} />
                        ))}
                      </div>
                      {ajustes.mostrarPrecios && p.precioCentavos !== null && (
                        <div className="text-sm font-semibold text-tinta-900">{formatoDinero(p.precioCentavos, ajustes.moneda)}</div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-tinta-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-tinta-500 sm:px-6">
          <span>
            © {new Date().getFullYear()} {ajustes.empresa}. Precios al mayor referenciales, sujetos a confirmación.
          </span>
          <button onClick={() => ir('admin')} className="hover:text-tinta-900">
            Administración
          </button>
        </div>
      </footer>

      {t.unidades > 0 && !pedidoAbierto && !abierto && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-tinta-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
          <button onClick={() => setPedidoAbierto(true)} className="foco flex h-11 w-full items-center justify-between rounded-lg bg-tinta-900 px-4 text-sm font-medium text-white">
            <span>Ver pedido · {t.unidades} uds</span>
            {ajustes.mostrarPrecios && t.montoCentavos > 0 && <span>{formatoDinero(t.montoCentavos, ajustes.moneda)}</span>}
          </button>
        </div>
      )}

      {abierto && (
        <DetalleProducto
          producto={abierto.producto}
          lineaInicial={abierto.linea}
          ajustes={ajustes}
          logo={logo}
          onLogo={setLogo}
          onCerrar={() => setAbierto(null)}
          onGuardar={(l, editando) => {
            guardarLinea(l);
            setAbierto(null);
            setAviso(editando ? 'Artículo actualizado en el pedido.' : 'Artículo agregado al pedido.');
          }}
        />
      )}

      <PanelPedido
        abierto={pedidoAbierto && !abierto}
        onCerrar={() => setPedidoAbierto(false)}
        lineas={lineas}
        setLineas={setLineas}
        cliente={cliente}
        setCliente={setCliente}
        logo={logo}
        setLogo={setLogo}
        ajustes={ajustes}
        onEditar={(l) => {
          const p = catalogo.productos.find((x) => x.id === l.productoId);
          if (p) {
            setPedidoAbierto(false);
            setAbierto({ producto: p, linea: l });
          }
        }}
      />

      {aviso && !pedidoAbierto && (
        <div className="aparece fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 sm:bottom-6">
          <div className="flex items-center gap-3 rounded-xl bg-tinta-950 px-4 py-3 text-sm text-white shadow-xl">
            <Check className="h-4 w-4 text-emerald-400" />
            <span>{aviso}</span>
            <button className="font-medium text-acento-100 underline" onClick={() => setPedidoAbierto(true)}>
              Ver pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BuscadorCampo({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-400" />
      <input
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder="Buscar por código o nombre"
        className="foco h-10 w-full rounded-lg border border-tinta-200 bg-tinta-50 pl-9 pr-3 text-sm placeholder:text-tinta-400 focus:bg-white"
      />
    </label>
  );
}

function EtiquetaLogo({ logo, onSubir }: { logo: LogoCliente | null; onSubir: () => void }) {
  return (
    <button
      onClick={onSubir}
      title={logo ? `Logo: ${logo.nombreArchivo}` : 'Subir el logo de tu empresa'}
      className="foco hidden h-10 items-center gap-2 rounded-lg border border-tinta-200 bg-white px-3 text-sm text-tinta-700 hover:border-tinta-300 sm:inline-flex"
    >
      {logo ? (
        <>
          <img src={logo.dataUrl} alt="" className="h-6 w-6 object-contain" />
          <span className="max-w-[8rem] truncate">Tu logo</span>
        </>
      ) : (
        <>
          <ImagePlus className="h-4 w-4" />
          <span>Subir logo</span>
        </>
      )}
    </button>
  );
}
