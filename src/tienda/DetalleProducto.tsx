import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Box, ImagePlus, Minus, Plus, Rotate3d, Trash2, X } from 'lucide-react';
import { formatoDinero } from '../core/dinero';
import {
  nuevoId,
  posicionesPara,
  preciosDe,
  tieneModelo3D,
  type Ajustes,
  type ColorProducto,
  type LineaPedido,
  type LogoCliente,
  type Producto,
} from '../core/modelo';
import {
  NIVELES,
  POSICIONES,
  TAMANOS,
  cotizar,
  esTallaGrande,
  precioTalla,
  tamanosPermitidos,
  tecnicasPermitidas,
  type Personalizacion,
  type Posicion,
  type Reglas,
  type Tamano,
} from '../core/reglas';
import { Aviso, Boton, Etiqueta } from '../ui/comunes';
import { Foto3D, type Foto3DRef } from '../visor3d/Foto3D';
import { Visor3D, type Visor3DRef } from '../visor3d/Visor3D';
import { vistaDe } from '../visor3d/escena';
import { leerLogo } from './logo';

const COLOR_NEUTRO: ColorProducto = { nombre: 'Como en la foto', hex: '#4a5468' };

export function DetalleProducto({
  producto: p,
  lineaInicial,
  ajustes,
  reglas,
  unidadesOtras,
  logo,
  onLogo,
  onCerrar,
  onGuardar,
}: {
  producto: Producto;
  lineaInicial?: LineaPedido;
  ajustes: Ajustes;
  reglas: Reglas;
  /** Unidades del resto del pedido (para las reglas que cuentan por pedido). */
  unidadesOtras: number;
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
  const posiciones = posicionesPara(p.forma);
  const tecnicas = useMemo(() => tecnicasPermitidas(p.tela, reglas), [p.tela, reglas]);
  const [personalizar, setPersonalizar] = useState((lineaInicial?.personalizaciones.length ?? 0) > 0);
  const [personalizaciones, setPersonalizaciones] = useState<Personalizacion[]>(lineaInicial?.personalizaciones ?? []);
  const [nota, setNota] = useState(lineaInicial?.nota ?? '');
  const hayModelo = tieneModelo3D(p.forma);
  // «Foto 3D» (la foto real girando) es la vista principal cuando el catálogo trae foto.
  const [vista, setVista] = useState<'foto3d' | 'modelo' | number>(p.foto ? 'foto3d' : 'modelo');
  const [modeloIniciado, setModeloIniciado] = useState(!p.foto || !!logo);
  const [ladoFoto, setLadoFoto] = useState<'frente' | 'espalda'>('frente');
  const foto3d = useRef<Foto3DRef>(null);
  const detalles = p.fotos ?? [];
  // Si el color elegido trae su propia foto, «Foto 3D» muestra la prenda en ese color (sin la espalda, que es de otro color).
  const fotoColor = color.fotoProducto ?? null;
  const frente = fotoColor ?? p.foto;
  const espalda = fotoColor ? null : p.fotoEspalda;
  useEffect(() => {
    if (vista === 'modelo' || logo) setModeloIniciado(true);
  }, [vista, logo]);
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

  const precios = preciosDe(p);
  const activas = useMemo(() => (personalizar ? personalizaciones : []), [personalizar, personalizaciones]);
  const cot = useMemo(() => {
    const propias = Object.values(cantidades).reduce((a, b) => a + (b || 0), 0);
    return cotizar({ cantidades, precios: preciosDe(p), preciosGrandes: p.preciosGrandes, tela: p.tela, personalizaciones: activas }, reglas, unidadesOtras + propias);
  }, [cantidades, activas, reglas, unidadesOtras, p]);
  const unidades = cot.unidades;
  const marcas = useMemo(
    () => (logo ? activas.map((x) => ({ posicion: x.posicion, cm: TAMANOS.find((t) => t.valor === x.tamano)?.cm ?? 10 })) : []),
    [activas, logo],
  );
  const bajoMinimo = p.minimo > 0 && unidades > 0 && unidades < p.minimo;
  const conStock = (t: string) => p.stock?.[t];
  const agotado = p.stock ? p.tallas.every((t) => (p.stock?.[t] ?? 1) <= 0) : false;
  const sinPrecio = precios.detal === null && precios.mayor === null && precios.distribuidor === null;
  const $ = (c: number | null) => (c === null ? 'Por confirmar' : formatoDinero(c, ajustes.moneda));

  const cambiar = (talla: string, valor: number) => {
    const max = conStock(talla) ?? 99999;
    setCantidades((c) => ({ ...c, [talla]: Math.max(0, Math.min(max, Math.round(valor) || 0)) }));
  };

  const nuevaPersonalizacion = (): Personalizacion | null => {
    const usadas = new Set(personalizaciones.map((x) => x.posicion));
    const posicion = posiciones.find((x) => !usadas.has(x)) ?? posiciones[0];
    const tecnica = tecnicas[0];
    if (!posicion || !tecnica) return null;
    const tamano = tamanosPermitidos(posicion, tecnica, reglas)[0];
    if (!tamano) return null;
    return { id: nuevoId('per'), posicion, tecnica: tecnica.id, tamano };
  };
  const cambiarPersonalizacion = (id: string, cambios: Partial<Personalizacion>) =>
    setPersonalizaciones((lista) =>
      lista.map((x) => {
        if (x.id !== id) return x;
        const n = { ...x, ...cambios };
        // Si el tamaño ya no se permite con la nueva técnica o posición, se toma el primero que sí.
        const permitidos = tamanosPermitidos(n.posicion, reglas.tecnicas.find((t) => t.id === n.tecnica), reglas);
        if (!permitidos.includes(n.tamano) && permitidos[0]) n.tamano = permitidos[0];
        return n;
      }),
    );
  const activarPersonalizacion = (si: boolean) => {
    setPersonalizar(si);
    if (si && personalizaciones.length === 0) {
      const n = nuevaPersonalizacion();
      if (n) setPersonalizaciones([n]);
    }
  };

  const subirLogo = async (archivo: File | undefined) => {
    if (!archivo) return;
    const r = await leerLogo(archivo);
    setErrorLogo(r.error ?? null);
    setAvisosLogo(r.avisos);
    if (r.logo) {
      onLogo(r.logo);
      if (hayModelo && activas.length) setVista('modelo');
    }
  };

  const guardar = () => {
    // Captura de la prenda tal como la configuró el cliente (frente o espalda según el logo).
    let vista3d: string | null = null;
    try {
      vista3d = !hayModelo || !marcas.length ? null : visor.current?.capturar(vistaDe(marcas[0].posicion)) ?? null;
    } catch {
      vista3d = null;
    }
    onGuardar(
      {
        id: lineaInicial?.id ?? nuevoId('lin'),
        productoId: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        // Si el catálogo trae la foto del color elegido, esa es la que ve el asesor.
        foto: color.fotoProducto || (p.colores.length && color.foto) || p.foto,
        forma: p.forma,
        color: p.colores.length ? color : null,
        cantidades: Object.fromEntries(Object.entries(cantidades).filter(([, n]) => n > 0)),
        precios,
        preciosGrandes: p.preciosGrandes,
        tela: p.tela,
        personalizaciones: activas,
        nota: nota.trim(),
        vista3d,
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
        <div className="estudio relative flex h-[50vh] shrink-0 flex-col lg:h-auto lg:flex-[1.15]">
          <div className="absolute left-3 top-3 z-10 inline-flex rounded-lg bg-white/90 p-1 shadow-sm ring-1 ring-tinta-200">
            {p.foto && (
              <button
                onClick={() => setVista('foto3d')}
                className={`foco inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${
                  vista === 'foto3d' || typeof vista === 'number' ? 'bg-tinta-900 text-white' : 'text-tinta-600 hover:text-tinta-900'
                }`}
              >
                <Rotate3d className="h-3.5 w-3.5" /> Foto 3D
              </button>
            )}
            {hayModelo && (
              <button
                onClick={() => setVista('modelo')}
                className={`foco inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${
                  vista === 'modelo' ? 'bg-tinta-900 text-white' : 'text-tinta-600 hover:text-tinta-900'
                }`}
              >
                <Box className="h-3.5 w-3.5" /> {logo ? 'Con tu logo' : 'Modelo 3D'}
              </button>
            )}
          </div>

          <div className="relative min-h-0 flex-1">
            {hayModelo && modeloIniciado && (
              <div className={vista === 'modelo' ? 'absolute inset-0' : 'invisible absolute inset-0'} aria-hidden={vista !== 'modelo'}>
                <Visor3D
                  ref={visor}
                  className="h-full w-full cursor-grab active:cursor-grabbing"
                  forma={p.forma}
                  colorHex={color.hex}
                  logo={logo?.dataUrl ?? null}
                  marcas={marcas}
                  escalaLogo={1}
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
                  <div className="text-[11px] text-tinta-500">
                    Arrastra para girar · Modelo de referencia en el color elegido{logo ? ', con tu logo' : ''}
                  </div>
                </div>
              </div>
            )}

            {vista === 'foto3d' && frente && (
              <div className="absolute inset-0 pb-14 pt-12 sm:pb-16">
                <Foto3D
                  key={`${p.id}|${frente}`}
                  ref={foto3d}
                  frente={frente}
                  espalda={espalda}
                  alt={p.nombre}
                  onLado={setLadoFoto}
                  className="h-full w-full cursor-grab active:cursor-grabbing"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-3">
                  {espalda ? (
                    <div className="pointer-events-auto inline-flex rounded-lg bg-white/90 p-1 shadow-sm ring-1 ring-tinta-200">
                      {(['frente', 'espalda'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => foto3d.current?.verLado(v)}
                          className={`foco h-8 rounded-md px-3 text-xs font-medium capitalize ${
                            ladoFoto === v ? 'bg-tinta-100 text-tinta-900' : 'text-tinta-600 hover:bg-tinta-100 hover:text-tinta-900'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="hidden text-[11px] text-tinta-500 sm:block">
                    {espalda ? 'Arrastra para girar y ver la espalda' : 'Arrastra para inclinar'} · {fotoColor ? `Color ${color.nombre}` : 'Foto real del catálogo'}
                  </div>
                </div>
              </div>
            )}

            {typeof vista === 'number' && detalles[vista] && (
              <div className="absolute inset-0 flex items-center justify-center p-4 pt-14">
                <img src={detalles[vista]} alt={`${p.nombre} · detalle ${vista + 1}`} className="max-h-full max-w-full rounded-lg object-contain shadow-sm" />
              </div>
            )}
          </div>

          {/* Fotos del catálogo */}
          {frente && (espalda || detalles.length > 0) && (
            <div className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-3 pt-1">
              {[
                { clave: 'frente', src: frente, activa: vista === 'foto3d' && ladoFoto === 'frente', ir: () => { setVista('foto3d'); setTimeout(() => foto3d.current?.verLado('frente'), 0); } },
                ...(espalda
                  ? [{ clave: 'espalda', src: espalda, activa: vista === 'foto3d' && ladoFoto === 'espalda', ir: () => { setVista('foto3d'); setTimeout(() => foto3d.current?.verLado('espalda'), 0); } }]
                  : []),
                ...detalles.map((src, i) => ({ clave: `d${i}`, src, activa: vista === i, ir: () => setVista(i) })),
              ].map((f) => (
                <button
                  key={f.clave}
                  onClick={f.ir}
                  aria-label={f.clave === 'frente' ? 'Ver frente' : f.clave === 'espalda' ? 'Ver espalda' : 'Ver detalle'}
                  className={`foco h-14 w-14 shrink-0 overflow-hidden rounded-md bg-white ${f.activa ? 'ring-2 ring-tinta-900' : 'ring-1 ring-tinta-200 hover:ring-tinta-400'}`}
                >
                  <img src={f.src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Configuración */}
        <div className="flex min-h-0 flex-1 flex-col lg:max-w-[480px] lg:border-l lg:border-tinta-100">
          <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5 sm:px-6">
            <div className="pr-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-tinta-500">SKU {p.codigo || '—'}</span>
                <Etiqueta>{p.categoria}</Etiqueta>
                {p.tela && <Etiqueta tono="acento">{p.tela}</Etiqueta>}
              </div>
              <h2 className="mt-1.5 text-xl font-semibold leading-snug tracking-tight">{p.nombre || 'Artículo'}</h2>
              {p.descripcion && <p className="mt-2 text-sm leading-relaxed text-tinta-600">{p.descripcion}</p>}
              {p.minimo > 0 && <div className="mt-1 text-xs text-tinta-500">Pedido mínimo: {p.minimo} unidades</div>}
            </div>

            {/* Precios por nivel */}
            {ajustes.mostrarPrecios && !sinPrecio && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tinta-500">Precio por unidad según la cantidad</h3>
                <div className="grid grid-cols-3 gap-2">
                  {NIVELES.map((n) => {
                    const desde = n.valor === 'detal' ? 1 : n.valor === 'mayor' ? reglas.niveles.mayorDesde : reglas.niveles.distribuidorDesde;
                    const hasta = n.valor === 'detal' ? reglas.niveles.mayorDesde - 1 : n.valor === 'mayor' ? reglas.niveles.distribuidorDesde - 1 : null;
                    const precio = precioTalla(p.tallas.find((t) => !esTallaGrande(t, reglas)) ?? 'M', n.valor, precios, p.preciosGrandes, reglas);
                    const actual = unidades > 0 && cot.nivel === n.valor;
                    return (
                      <div key={n.valor} className={`rounded-lg border p-2.5 ${actual ? 'border-tinta-900 bg-tinta-900 text-white' : 'border-tinta-200'}`}>
                        <div className={`text-[11px] font-medium ${actual ? 'text-tinta-200' : 'text-tinta-500'}`}>{n.etiqueta}</div>
                        <div className="text-base font-semibold">{$(precio)}</div>
                        <div className={`text-[11px] ${actual ? 'text-tinta-200' : 'text-tinta-500'}`}>
                          {hasta === null ? `${desde}+ uds` : `${desde}–${hasta} uds`}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {p.tallas.some((t) => esTallaGrande(t, reglas)) && (
                  <p className="mt-1.5 text-[11px] text-tinta-500">
                    Tallas {p.tallas.filter((t) => esTallaGrande(t, reglas)).join(', ')}:{' '}
                    {p.preciosGrandes ? 'precio propio' : reglas.tallasGrandes.tipo === 'porcentaje' ? `+${reglas.tallasGrandes.valor} %` : `+${$(reglas.tallasGrandes.valor)}`} por unidad.
                    {reglas.conteo === 'pedido' ? ' El nivel se calcula con todas las prendas del pedido.' : ''}
                  </p>
                )}
              </section>
            )}

            {p.ficha && p.ficha.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-tinta-500 hover:text-tinta-900">Ficha técnica</summary>
                <dl className="mt-2 divide-y divide-tinta-100 rounded-lg border border-tinta-200 text-sm">
                  {p.ficha.map((d) => (
                    <div key={d.titulo} className={`grid grid-cols-[110px_1fr] gap-3 px-3 py-2 ${d.titulo === 'Advertencia' ? 'bg-amber-50/70' : ''}`}>
                      <dt className="text-xs font-medium text-tinta-500">{d.titulo}</dt>
                      <dd className="text-tinta-800">{d.texto}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}

            {/* Color */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tinta-500">
                Color <span className="ml-1 font-normal normal-case tracking-normal text-tinta-700">{color.nombre}</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {colores.map((c) =>
                  c.foto || c.fotoProducto ? (
                    <button
                      key={c.nombre}
                      onClick={() => setColor(c)}
                      title={c.nombre}
                      aria-label={`Color ${c.nombre}`}
                      className={`foco relative h-14 w-12 overflow-hidden rounded-lg bg-white transition ${
                        color.nombre === c.nombre ? 'ring-2 ring-tinta-900' : 'ring-1 ring-tinta-200 hover:ring-tinta-400'
                      }`}
                    >
                      <img src={(c.foto || c.fotoProducto)!} alt="" className="h-10 w-full object-contain" />
                      <span className="absolute inset-x-0 bottom-0 flex h-4 items-center justify-center gap-1 text-[10px] font-semibold text-tinta-700">
                        <span className="h-2 w-2 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
                        {c.codigo ?? ''}
                      </span>
                    </button>
                  ) : (
                    <button
                      key={c.nombre}
                      onClick={() => setColor(c)}
                      title={c.nombre}
                      aria-label={`Color ${c.nombre}`}
                      className={`foco h-9 w-9 rounded-full ring-offset-2 transition ${
                        color.nombre === c.nombre ? 'ring-2 ring-tinta-900' : 'ring-1 ring-tinta-200 hover:ring-tinta-400'
                      }`}
                      style={{ background: c.hex }}
                    />
                  ),
                )}
              </div>
            </section>

            {/* Matriz de tallas */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-500">Cantidades por talla</h3>
                {unidades > 0 && (
                  <button onClick={() => setCantidades(Object.fromEntries(p.tallas.map((t) => [t, 0])))} className="text-xs text-tinta-500 hover:text-tinta-900">
                    Limpiar
                  </button>
                )}
              </div>
              {agotado && <div className="mb-2"><Aviso tono="aviso">Este artículo está agotado por ahora.</Aviso></div>}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
                {p.tallas.map((t) => {
                  const hay = conStock(t);
                  const sinStock = hay !== undefined && hay <= 0;
                  const lleno = hay !== undefined && (cantidades[t] || 0) >= hay;
                  return (
                    <div
                      key={t}
                      className={`rounded-lg border p-2 ${sinStock ? 'border-tinta-100 bg-tinta-50 opacity-60' : cantidades[t] > 0 ? 'border-tinta-900 bg-tinta-50' : 'border-tinta-200'}`}
                    >
                      <div className="mb-1 flex items-baseline justify-between gap-1">
                        <span className="text-xs font-semibold text-tinta-700">{t}</span>
                        {esTallaGrande(t, reglas) && <span className="text-[9px] font-medium uppercase text-acento-600">grande</span>}
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <button
                          onClick={() => cambiar(t, (cantidades[t] || 0) - 1)}
                          disabled={sinStock}
                          className="foco grid h-7 w-7 shrink-0 place-items-center rounded-md text-tinta-500 hover:bg-tinta-100 disabled:opacity-40"
                          aria-label={`Menos ${t}`}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={hay}
                          disabled={sinStock}
                          value={cantidades[t] || ''}
                          placeholder="0"
                          onChange={(e) => cambiar(t, Number(e.target.value))}
                          aria-label={`Cantidad talla ${t}`}
                          className="foco h-7 w-full min-w-0 rounded-md bg-transparent text-center text-sm font-semibold placeholder:text-tinta-300"
                        />
                        <button
                          onClick={() => cambiar(t, (cantidades[t] || 0) + 1)}
                          disabled={sinStock || lleno}
                          className="foco grid h-7 w-7 shrink-0 place-items-center rounded-md text-tinta-500 hover:bg-tinta-100 disabled:opacity-40"
                          aria-label={`Más ${t}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className={`mt-1 text-center text-[10px] ${sinStock ? 'font-medium text-red-700' : lleno ? 'font-medium text-amber-700' : 'text-tinta-500'}`}>
                        {hay === undefined ? 'Consultar stock' : sinStock ? 'Agotado' : lleno ? `Máx. ${hay}` : `Stock: ${hay}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Personalización */}
            {posiciones.length > 0 && tecnicas.length > 0 ? (
              <section>
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-tinta-500">¿Personalizar esta prenda?</span>
                    <span className="block text-xs text-tinta-500">Logo bordado o estampado en una o varias posiciones.</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={personalizar}
                    onChange={(e) => activarPersonalizacion(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="relative h-6 w-11 shrink-0 rounded-full bg-tinta-200 transition peer-checked:bg-tinta-900 peer-focus-visible:ring-2 peer-focus-visible:ring-acento-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
                </label>

                {personalizar && (
                  <div className="mt-3 space-y-3">
                    <input
                      ref={entradaLogo}
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        void subirLogo(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    {logo ? (
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
                    ) : (
                      <button
                        onClick={() => entradaLogo.current?.click()}
                        className="foco flex w-full items-center gap-3 rounded-lg border border-dashed border-tinta-300 px-4 py-3 text-left hover:border-tinta-500 hover:bg-tinta-50"
                      >
                        <ImagePlus className="h-6 w-6 shrink-0 text-tinta-500" />
                        <span>
                          <span className="block text-sm font-medium">Sube tu logo (PNG, JPG o PDF)</span>
                          <span className="block text-xs text-tinta-500">Lo verás sobre la prenda. También puedes enviarlo luego por WhatsApp.</span>
                        </span>
                      </button>
                    )}
                    {errorLogo && <Aviso tono="error">{errorLogo}</Aviso>}
                    {avisosLogo.length > 0 && <Aviso tono="aviso">{avisosLogo.join(' ')}</Aviso>}

                    {personalizaciones.map((x, i) => {
                      const c = cot.personalizaciones.find((y) => y.id === x.id);
                      const tecnica = reglas.tecnicas.find((t) => t.id === x.tecnica);
                      const tamanos = tamanosPermitidos(x.posicion, tecnica, reglas);
                      return (
                        <div key={x.id} className={`rounded-xl border p-3 ${c?.error ? 'border-amber-300 bg-amber-50/60' : 'border-tinta-200'}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-tinta-700">Personalización {i + 1}</span>
                            <button
                              onClick={() => setPersonalizaciones((l) => l.filter((y) => y.id !== x.id))}
                              className="foco rounded p-1 text-tinta-400 hover:text-red-600"
                              aria-label={`Quitar personalización ${i + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-medium text-tinta-600">Posición</span>
                              <select
                                value={x.posicion}
                                onChange={(e) => cambiarPersonalizacion(x.id, { posicion: e.target.value as Posicion })}
                                className="foco h-9 w-full rounded-lg border border-tinta-200 bg-white px-2 text-sm"
                              >
                                {posiciones.map((pos) => (
                                  <option key={pos} value={pos}>
                                    {POSICIONES[pos]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-medium text-tinta-600">Técnica</span>
                              <select
                                value={x.tecnica}
                                onChange={(e) => cambiarPersonalizacion(x.id, { tecnica: e.target.value })}
                                className="foco h-9 w-full rounded-lg border border-tinta-200 bg-white px-2 text-sm"
                              >
                                {tecnicas.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.nombre}
                                    {t.minimo > 0 ? ` (mín. ${t.minimo})` : ''}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-medium text-tinta-600">Tamaño</span>
                              <select
                                value={x.tamano}
                                onChange={(e) => cambiarPersonalizacion(x.id, { tamano: e.target.value as Tamano })}
                                className="foco h-9 w-full rounded-lg border border-tinta-200 bg-white px-2 text-sm"
                              >
                                {TAMANOS.filter((t) => tamanos.includes(t.valor)).map((t) => (
                                  <option key={t.valor} value={t.valor}>
                                    {t.etiqueta} ({t.cm} cm)
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="mt-2 text-xs">
                            {c?.error ? (
                              <span className="inline-flex items-center gap-1 text-amber-800">
                                <AlertTriangle className="h-3.5 w-3.5" /> {c.error}
                              </span>
                            ) : ajustes.mostrarPrecios && c ? (
                              <span className="text-tinta-600">
                                {c.descuento > 0 && <span className="mr-1 text-tinta-400 line-through">{$(c.precioBase)}</span>}
                                <b className="text-tinta-900">{$(c.precioUnitario)}</b> por prenda
                                {c.descuento > 0 && ` (-${c.descuento} % por ${cot.unidadesConteo} uds)`}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {personalizaciones.length < posiciones.length && (
                      <Boton
                        variante="secundario"
                        tamano="sm"
                        onClick={() => {
                          const n = nuevaPersonalizacion();
                          if (n) setPersonalizaciones((l) => [...l, n]);
                        }}
                      >
                        <Plus className="h-4 w-4" /> Agregar otra posición
                      </Boton>
                    )}
                    {ajustes.mostrarPrecios && reglas.escalas.some((e) => e.descuento > 0) && (
                      <p className="text-[11px] text-tinta-500">
                        Descuento en la personalización:{' '}
                        {reglas.escalas
                          .filter((e) => e.descuento > 0)
                          .map((e) => `-${e.descuento} % desde ${e.desde} uds`)
                          .join(' · ')}
                        .
                      </p>
                    )}
                  </div>
                )}
              </section>
            ) : (
              <p className="text-xs text-tinta-500">Este artículo no se personaliza desde aquí. Si lo necesitas, indícalo abajo y el asesor te confirmará.</p>
            )}

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
            {bajoMinimo && <div className="mb-2 text-xs text-amber-700">El mínimo es {p.minimo} unidades; el asesor te confirmará si se puede.</div>}
            {cot.errores.length > 0 && unidades > 0 && (
              <div className="mb-2 text-xs text-amber-800">Revisa la personalización: {cot.errores[0]}</div>
            )}
            {ajustes.mostrarPrecios && unidades > 0 && (
              <div className="mb-2 flex flex-wrap gap-x-3 text-xs text-tinta-600">
                <span>
                  Prenda ({NIVELES.find((n) => n.valor === cot.nivel)?.etiqueta.toLowerCase()}): {$(cot.prendaSubtotal)}
                </span>
                {cot.personalizacionSubtotal > 0 && (
                  <span>
                    Personalización: {$(cot.personalizacionUnitaria)} × {unidades} = {$(cot.personalizacionSubtotal)}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="min-w-0">
                <div className="text-xs text-tinta-500">{unidades} unidades</div>
                <div className="text-lg font-semibold">{ajustes.mostrarPrecios && unidades > 0 ? $(cot.subtotal) : unidades > 0 ? 'Precio por confirmar' : '—'}</div>
              </div>
              <Boton tamano="lg" className="ml-auto" disabled={unidades === 0 || (personalizar && cot.errores.length > 0)} onClick={guardar}>
                {lineaInicial ? 'Guardar cambios' : 'Agregar al pedido'}
              </Boton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
