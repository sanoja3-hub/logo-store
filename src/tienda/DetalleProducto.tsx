import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Image as ImageIcon, ImagePlus, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { formatoDinero } from '../core/dinero';
import {
  TECNICAS,
  UBICACIONES,
  nuevoId,
  ubicacionesPara,
  type Ajustes,
  type ColorProducto,
  type LineaPedido,
  type LogoCliente,
  type Producto,
  type Tecnica,
  type Ubicacion,
} from '../core/modelo';
import { Aviso, Boton, Etiqueta, Foto } from '../ui/comunes';
import { Visor3D, type Visor3DRef } from '../visor3d/Visor3D';
import { leerLogo } from './logo';

const COLOR_NEUTRO: ColorProducto = { nombre: 'Como en la foto', hex: '#4a5468' };

export function DetalleProducto({
  producto: p,
  lineaInicial,
  ajustes,
  logo,
  onLogo,
  onCerrar,
  onGuardar,
}: {
  producto: Producto;
  lineaInicial?: LineaPedido;
  ajustes: Ajustes;
  logo: LogoCliente | null;
  onLogo: (l: LogoCliente | null) => void;
  onCerrar: () => void;
  onGuardar: (l: LineaPedido, editando: boolean) => void;
}) {
  const colores = p.colores.length ? p.colores : [COLOR_NEUTRO];
  const [color, setColor] = useState<ColorProducto>(lineaInicial?.color ?? colores[0]);
  const [cantidades, setCantidades] = useState<Record<string, number>>(
    () => lineaInicial?.cantidades ?? Object.fromEntries(p.tallas.map((t) => [t, 0])),
  );
  const ubicaciones = ubicacionesPara(p.forma);
  const [ubicacion, setUbicacion] = useState<Ubicacion>(lineaInicial?.ubicacion ?? ubicaciones[0]);
  const [tecnica, setTecnica] = useState<Tecnica>(lineaInicial?.tecnica ?? 'Bordado');
  const [escala, setEscala] = useState(1);
  const [nota, setNota] = useState(lineaInicial?.nota ?? '');
  const [vista, setVista] = useState<'3d' | 'foto'>('3d');
  const [avisosLogo, setAvisosLogo] = useState<string[]>([]);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  const visor = useRef<Visor3DRef>(null);
  const entradaLogo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = previo;
    };
  }, [onCerrar]);

  const unidades = useMemo(() => Object.values(cantidades).reduce((a, b) => a + (b || 0), 0), [cantidades]);
  const subtotal = p.precioCentavos !== null ? p.precioCentavos * unidades : null;
  const bajoMinimo = p.minimo > 0 && unidades > 0 && unidades < p.minimo;

  const cambiar = (talla: string, valor: number) =>
    setCantidades((c) => ({ ...c, [talla]: Math.max(0, Math.min(99999, Math.round(valor) || 0)) }));

  const subirLogo = async (archivo: File | undefined) => {
    if (!archivo) return;
    const r = await leerLogo(archivo);
    setErrorLogo(r.error ?? null);
    setAvisosLogo(r.avisos);
    if (r.logo) {
      onLogo(r.logo);
      if (ubicacion === 'sin_logo') setUbicacion(ubicaciones[0]);
      setVista('3d');
    }
  };

  const guardar = () => {
    // Captura de la prenda tal como la configuró el cliente (frente o espalda según el logo).
    let vista3d: string | null = null;
    try {
      vista3d = visor.current?.capturar(ubicacion === 'espalda' ? 'espalda' : ubicacion === 'manga' ? 'lado' : 'frente') ?? null;
    } catch {
      vista3d = null;
    }
    onGuardar(
      {
        id: lineaInicial?.id ?? nuevoId('lin'),
        productoId: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        foto: p.foto,
        forma: p.forma,
        color: p.colores.length ? color : null,
        cantidades: Object.fromEntries(Object.entries(cantidades).filter(([, n]) => n > 0)),
        precioCentavos: p.precioCentavos,
        ubicacion: logo ? ubicacion : 'sin_logo',
        tecnica,
        nota: nota.trim(),
        vista3d: logo && ubicacion !== 'sin_logo' ? vista3d : null,
      },
      !!lineaInicial,
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-tinta-950/50 backdrop-blur-[2px]" onClick={onCerrar} />
      <div className="aparece relative flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(92vh,820px)] sm:rounded-2xl lg:flex-row">
        <button
          onClick={onCerrar}
          className="foco absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-tinta-600 shadow ring-1 ring-tinta-200 hover:text-tinta-900"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Escenario */}
        <div className="estudio relative h-[46vh] shrink-0 lg:h-auto lg:flex-[1.15]">
          <div className="absolute left-3 top-3 z-10 inline-flex rounded-lg bg-white/90 p-1 shadow-sm ring-1 ring-tinta-200">
            {(
              [
                ['3d', 'Vista 3D', Box],
                ['foto', 'Foto', ImageIcon],
              ] as const
            ).map(([v, et, Icono]) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`foco inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${
                  vista === v ? 'bg-tinta-900 text-white' : 'text-tinta-600 hover:text-tinta-900'
                }`}
              >
                <Icono className="h-3.5 w-3.5" /> {et}
              </button>
            ))}
          </div>
          <div className={vista === '3d' ? 'h-full' : 'hidden'}>
            <Visor3D
              ref={visor}
              className="h-full w-full cursor-grab active:cursor-grabbing"
              forma={p.forma}
              colorHex={color.hex}
              logo={logo?.dataUrl ?? null}
              ubicacion={logo ? ubicacion : 'sin_logo'}
              escalaLogo={escala}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-3">
              <div className="pointer-events-auto inline-flex rounded-lg bg-white/90 p-1 shadow-sm ring-1 ring-tinta-200">
                {(['frente', 'espalda', 'lado'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => visor.current?.verVista(v)}
                    className="foco h-8 rounded-md px-3 text-xs font-medium capitalize text-tinta-600 hover:bg-tinta-100 hover:text-tinta-900"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-tinta-500">Arrastra para girar · Representación 3D de referencia</div>
            </div>
          </div>
          {vista === 'foto' && (
            <div className="flex h-full items-center justify-center bg-white p-6 pt-14">
              <Foto src={p.foto} alt={p.nombre} className="max-h-full max-w-full" />
            </div>
          )}
        </div>

        {/* Configuración */}
        <div className="flex min-h-0 flex-1 flex-col lg:max-w-[460px] lg:border-l lg:border-tinta-100">
          <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5 sm:px-6">
            <div className="pr-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-tinta-500">{p.codigo || 'Sin código'}</span>
                <Etiqueta>{p.categoria}</Etiqueta>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold leading-snug tracking-tight">{p.nombre || 'Artículo'}</h2>
              {p.descripcion && <p className="mt-2 text-sm leading-relaxed text-tinta-600">{p.descripcion}</p>}
              {ajustes.mostrarPrecios && p.precioCentavos !== null && (
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">{formatoDinero(p.precioCentavos, ajustes.moneda)}</span>
                  <span className="text-xs text-tinta-500">por unidad, al mayor</span>
                </div>
              )}
              {p.minimo > 0 && <div className="mt-1 text-xs text-tinta-500">Pedido mínimo: {p.minimo} unidades</div>}
            </div>

            {/* Color */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tinta-500">
                Color <span className="ml-1 font-normal normal-case tracking-normal text-tinta-700">{color.nombre}</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {colores.map((c) => (
                  <button
                    key={c.nombre}
                    onClick={() => setColor(c)}
                    title={c.nombre}
                    className={`foco h-9 w-9 rounded-full ring-offset-2 transition ${
                      color.nombre === c.nombre ? 'ring-2 ring-tinta-900' : 'ring-1 ring-tinta-200 hover:ring-tinta-400'
                    }`}
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            </section>

            {/* Tallas */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-500">Cantidades por talla</h3>
                {unidades > 0 && (
                  <button onClick={() => setCantidades(Object.fromEntries(p.tallas.map((t) => [t, 0])))} className="text-xs text-tinta-500 hover:text-tinta-900">
                    Limpiar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
                {p.tallas.map((t) => (
                  <div key={t} className={`rounded-lg border p-2 ${cantidades[t] > 0 ? 'border-tinta-900 bg-tinta-50' : 'border-tinta-200'}`}>
                    <div className="mb-1 text-center text-xs font-semibold text-tinta-700">{t}</div>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        onClick={() => cambiar(t, (cantidades[t] || 0) - 1)}
                        className="foco grid h-7 w-7 shrink-0 place-items-center rounded-md text-tinta-500 hover:bg-tinta-100"
                        aria-label={`Menos ${t}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={cantidades[t] || ''}
                        placeholder="0"
                        onChange={(e) => cambiar(t, Number(e.target.value))}
                        aria-label={`Cantidad talla ${t}`}
                        className="foco h-7 w-full min-w-0 rounded-md bg-transparent text-center text-sm font-semibold placeholder:text-tinta-300"
                      />
                      <button
                        onClick={() => cambiar(t, (cantidades[t] || 0) + 1)}
                        className="foco grid h-7 w-7 shrink-0 place-items-center rounded-md text-tinta-500 hover:bg-tinta-100"
                        aria-label={`Más ${t}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Logo */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tinta-500">Logo de tu empresa</h3>
              <input
                ref={entradaLogo}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  void subirLogo(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {logo ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-tinta-200 p-2">
                    <div className="grid h-12 w-12 place-items-center rounded-md bg-[conic-gradient(#eef1f5_25%,#fff_0_50%,#eef1f5_0_75%,#fff_0)] bg-[length:12px_12px]">
                      <img src={logo.dataUrl} alt="Logo" className="max-h-10 max-w-10 object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{logo.nombreArchivo}</div>
                      <div className="text-xs text-tinta-500">
                        {logo.ancho}×{logo.alto} px{logo.tieneTransparencia ? ' · fondo transparente' : ''}
                      </div>
                    </div>
                    <Boton variante="fantasma" tamano="sm" onClick={() => entradaLogo.current?.click()}>
                      Cambiar
                    </Boton>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ubicaciones.map((u) => (
                      <button
                        key={u}
                        onClick={() => setUbicacion(u)}
                        className={`foco h-8 rounded-md px-3 text-xs font-medium ${
                          ubicacion === u ? 'bg-tinta-900 text-white' : 'bg-white text-tinta-600 ring-1 ring-tinta-200 hover:text-tinta-900'
                        }`}
                      >
                        {UBICACIONES[u]}
                      </button>
                    ))}
                  </div>
                  {ubicacion !== 'sin_logo' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-tinta-600">Técnica</span>
                        <select
                          value={tecnica}
                          onChange={(e) => setTecnica(e.target.value as Tecnica)}
                          className="foco h-10 w-full rounded-lg border border-tinta-200 bg-white px-2 text-sm"
                        >
                          {TECNICAS.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 flex justify-between text-xs font-medium text-tinta-600">
                          Tamaño en la vista <RotateCcw className="h-3.5 w-3.5 cursor-pointer" onClick={() => setEscala(1)} />
                        </span>
                        <input
                          type="range"
                          min={0.6}
                          max={1.6}
                          step={0.05}
                          value={escala}
                          onChange={(e) => setEscala(Number(e.target.value))}
                          className="h-10 w-full accent-tinta-900"
                        />
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => entradaLogo.current?.click()}
                  className="foco flex w-full items-center gap-3 rounded-lg border border-dashed border-tinta-300 px-4 py-4 text-left hover:border-tinta-500 hover:bg-tinta-50"
                >
                  <ImagePlus className="h-6 w-6 shrink-0 text-tinta-500" />
                  <span>
                    <span className="block text-sm font-medium">Sube tu logo en PNG</span>
                    <span className="block text-xs text-tinta-500">Lo verás sobre la prenda y le llegará al asesor con la orden.</span>
                  </span>
                </button>
              )}
              {errorLogo && <div className="mt-2"><Aviso tono="error">{errorLogo}</Aviso></div>}
              {avisosLogo.length > 0 && (
                <div className="mt-2">
                  <Aviso tono="aviso">{avisosLogo.join(' ')}</Aviso>
                </div>
              )}
            </section>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-tinta-600">Indicaciones para este artículo (opcional)</span>
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej.: nombre bordado en la manga, hilo dorado…"
                className="foco h-10 w-full rounded-lg border border-tinta-200 px-3 text-sm placeholder:text-tinta-300"
              />
            </label>
          </div>

          <div className="border-t border-tinta-100 bg-tinta-50/70 px-5 py-4 sm:px-6">
            {bajoMinimo && (
              <div className="mb-2 text-xs text-amber-700">
                El mínimo es {p.minimo} unidades; el asesor te confirmará si se puede.
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="min-w-0">
                <div className="text-xs text-tinta-500">{unidades} unidades</div>
                <div className="text-lg font-semibold">
                  {ajustes.mostrarPrecios && subtotal !== null ? formatoDinero(subtotal, ajustes.moneda) : unidades > 0 ? 'Precio por confirmar' : '—'}
                </div>
              </div>
              <Boton tamano="lg" className="ml-auto" disabled={unidades === 0} onClick={guardar}>
                {lineaInicial ? 'Guardar cambios' : 'Agregar al pedido'}
              </Boton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
