import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Download, Eye, FileUp, ImagePlus, ImageOff, Lock, Plus, Settings2, Trash2, Upload } from 'lucide-react';
import { almacen, cargarCatalogoPublico, catalogoVacio } from '../core/almacen';
import { contarFotos, quitarFotos, type FotoSinAsignar } from '../core/fotos';
import { formatoDinero } from '../core/dinero';
import { leerTallas } from '../core/interpretar';
import { aplicarConfiguracion, esConfiguracion, exportarConfiguracion } from '../core/configuracion';
import { FORMAS_3D, nuevoId, preciosDe, type Ajustes, type Catalogo, type Forma3D, type Producto } from '../core/modelo';
import { NIVELES, esTallaGrande, reglasCompletas, type Reglas } from '../core/reglas';
import { CampoPrecio, ReglasForm } from './ReglasForm';
import { SucursalesForm } from './SucursalesForm';
import { categoriaDe } from '../importar/armar';
import { normalizarFoto, reducirImagen } from '../importar/imagenes';
import { abrirPaquete, aplicarFotos, armarPaquete } from '../importar/paquete';
import type { ResultadoImportacion } from '../importar/tipos';
import { descargar } from '../pedido/documentos';
import { ir } from '../ruta';
import { AreaTexto, Aviso, Boton, Campo, Etiqueta, Foto } from '../ui/comunes';

type Pestana = 'importar' | 'revisar' | 'reglas' | 'sucursales' | 'ajustes' | 'publicar';

const CLAVE_PIN = 'atelier:panel-abierto';

/** PIN de demostración: evita que un cliente entre al panel por curiosidad. No es seguridad real. */
function PedirPin({ pin, onListo }: { pin: string; onListo: () => void }) {
  const [valor, setValor] = useState('');
  const [error, setError] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valor === pin) {
            try {
              sessionStorage.setItem(CLAVE_PIN, '1');
            } catch {
              // sin almacenamiento
            }
            onListo();
          } else setError(true);
        }}
        className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-tinta-200"
      >
        <Lock className="mx-auto h-8 w-8 text-tinta-500" />
        <div className="mt-2 text-base font-semibold">Panel de administración</div>
        <p className="mt-1 text-xs text-tinta-500">Escribe el PIN para entrar.</p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setError(false);
          }}
          aria-label="PIN"
          className={`foco mt-4 h-11 w-full rounded-lg border px-3 text-center text-lg tracking-[0.4em] ${error ? 'border-red-400' : 'border-tinta-200'}`}
        />
        {error && <div className="mt-2 text-xs text-red-700">PIN incorrecto.</div>}
        <Boton type="submit" className="mt-4 w-full">
          Entrar
        </Boton>
        <button type="button" onClick={() => ir('tienda')} className="mt-3 text-xs text-tinta-500 hover:text-tinta-900">
          Volver al catálogo
        </button>
      </form>
    </div>
  );
}

export function Admin() {
  const [cat, setCat] = useState<Catalogo | null>(null);
  const [pestana, setPestana] = useState<Pestana>('importar');
  const [abierto, setAbierto] = useState(() => {
    try {
      return sessionStorage.getItem(CLAVE_PIN) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    (async () => {
      const b = await almacen.leerBorrador();
      if (b) {
        setCat(b);
        setPestana(b.productos.length ? 'revisar' : 'importar');
      } else {
        // Primera vez: se parte del catálogo publicado, para poder editarlo.
        const { catalogo, fuente } = await cargarCatalogoPublico();
        setCat(fuente === 'vacio' ? catalogoVacio() : { ...catalogo, productos: catalogo.productos.map((p) => ({ ...p, avisos: p.avisos ?? [] })) });
      }
      document.title = 'Panel · Showroom';
    })();
  }, []);

  useEffect(() => {
    if (cat) void almacen.guardarBorrador(cat);
  }, [cat]);

  if (!cat) return <div className="grid min-h-screen place-items-center text-sm text-tinta-500">Cargando…</div>;
  if (!abierto) return <PedirPin pin={cat.ajustes.pin || '1234'} onListo={() => setAbierto(true)} />;
  const reglas = reglasCompletas(cat.reglas);
  const conAvisos = cat.productos.filter((p) => p.avisos.length > 0).length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-tinta-200 bg-tinta-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <button onClick={() => ir('tienda')} className="foco inline-flex items-center gap-1.5 rounded-md p-1.5 text-sm text-tinta-200 hover:bg-white/10 hover:text-white" aria-label="Volver al catálogo">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="text-[15px] font-semibold">Panel del catálogo</div>
            <div className="text-xs text-tinta-300">{cat.ajustes.empresa} · {cat.productos.length} artículos en borrador</div>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {(
            [
              ['importar', '1. Importar'],
              ['revisar', `2. Artículos (${cat.productos.length})`],
              ['reglas', '3. Precios y reglas'],
              ['sucursales', `4. Sucursales (${cat.sucursales?.length ?? 0})`],
              ['ajustes', '5. Ajustes'],
              ['publicar', '6. Publicar'],
            ] as [Pestana, string][]
          ).map(([k, et]) => (
            <button
              key={k}
              onClick={() => setPestana(k)}
              className={`foco shrink-0 border-b-2 px-3 pb-3 pt-1 text-sm font-medium ${
                pestana === k ? 'border-acento-500 text-white' : 'border-transparent text-tinta-300 hover:text-white'
              }`}
            >
              {et}
              {k === 'revisar' && conAvisos > 0 && <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold text-tinta-950">{conAvisos}</span>}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {pestana === 'importar' && (
          <Importar
            cantidadActual={cat.productos.length}
            onImportado={(ps, reemplazar) => {
              setCat((c) => c && { ...c, productos: reemplazar ? ps : [...c.productos, ...ps] });
              setPestana('revisar');
            }}
          />
        )}
        {pestana === 'revisar' && <Revisar cat={cat} setCat={setCat} reglas={reglas} />}
        {pestana === 'reglas' && <ReglasForm reglas={reglas} moneda={cat.ajustes.moneda} onCambio={(r) => setCat((c) => c && { ...c, reglas: r })} />}
        {pestana === 'sucursales' && <SucursalesForm sucursales={cat.sucursales ?? []} onCambio={(s) => setCat((c) => c && { ...c, sucursales: s })} />}
        {pestana === 'ajustes' && <AjustesForm ajustes={cat.ajustes} onCambio={(a) => setCat((c) => c && { ...c, ajustes: a })} />}
        {pestana === 'publicar' && <Publicar cat={cat} setCat={setCat} />}
      </main>
    </div>
  );
}

function Importar({ cantidadActual, onImportado }: { cantidadActual: number; onImportado: (p: Producto[], reemplazar: boolean) => void }) {
  const [progreso, setProgreso] = useState<{ msg: string; f: number } | null>(null);
  const [resultado, setResultado] = useState<(ResultadoImportacion & { archivo: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const procesar = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    setResultado(null);
    setProgreso({ msg: 'Abriendo el archivo', f: 0 });
    try {
      const avance = (msg: string, f: number) => setProgreso({ msg, f });
      let r: ResultadoImportacion;
      if (/\.pdf$/i.test(archivo.name) || archivo.type === 'application/pdf') {
        r = await (await import('../importar/pdf')).importarPdf(archivo, avance);
      } else if (/\.(xlsx|xls|csv)$/i.test(archivo.name)) {
        r = await (await import('../importar/excel')).importarExcel(archivo, avance);
      } else {
        throw new Error('Formato no reconocido. Usa un PDF, un Excel (.xlsx) o un CSV.');
      }
      setResultado({ ...r, archivo: archivo.name });
    } catch (e) {
      console.error(e);
      setError((e as Error).message || 'No se pudo leer el archivo.');
    } finally {
      setProgreso(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            void procesar(e.dataTransfer.files[0]);
          }}
          className={`rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center transition ${
            arrastrando ? 'border-tinta-900 bg-tinta-50' : 'border-tinta-300'
          }`}
        >
          <FileUp className="mx-auto h-10 w-10 text-tinta-400" />
          <div className="mt-3 text-base font-semibold">Arrastra aquí el catálogo</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-tinta-500">PDF con fotos y textos, o Excel (.xlsx) con fotos en las celdas. También CSV sin fotos.</p>
          <input
            ref={entrada}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,application/pdf"
            className="hidden"
            onChange={(e) => {
              void procesar(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Boton className="mt-5" onClick={() => entrada.current?.click()} disabled={!!progreso}>
            <Upload className="h-4 w-4" /> Elegir archivo
          </Boton>
          {progreso && (
            <div className="mx-auto mt-6 max-w-sm text-left">
              <div className="mb-1 text-xs text-tinta-600">{progreso.msg}…</div>
              <div className="h-2 overflow-hidden rounded-full bg-tinta-100">
                <div className="h-full rounded-full bg-tinta-900 transition-all" style={{ width: `${Math.round(progreso.f * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        {error && (
          <div className="mt-4">
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}
        {resultado && (
          <div className="mt-4 rounded-2xl border border-tinta-200 bg-white p-5">
            <div className="text-base font-semibold">
              {resultado.productos.length} artículos leídos de «{resultado.archivo}»
            </div>
            <div className="mt-1 text-sm text-tinta-600">
              {resultado.productos.filter((p) => p.foto).length} con foto · {resultado.productos.filter((p) => p.codigo).length} con código ·{' '}
              {resultado.productos.filter((p) => p.precioCentavos !== null).length} con precio · {resultado.productos.filter((p) => p.avisos.length).length} para revisar
            </div>
            {resultado.avisos.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-amber-800">
                {resultado.avisos.map((a) => (
                  <li key={a} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {a}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {resultado.productos.slice(0, 12).map((p) => (
                <div key={p.id} className="aspect-square overflow-hidden rounded-lg border border-tinta-100 bg-white">
                  <Foto src={p.foto} alt={p.nombre} className="h-full w-full p-1" />
                </div>
              ))}
            </div>
            {resultado.productos.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Boton onClick={() => onImportado(resultado.productos, cantidadActual === 0 || false)}>
                  {cantidadActual > 0 ? 'Agregar al catálogo' : 'Pasar a revisión'}
                </Boton>
                {cantidadActual > 0 && (
                  <Boton variante="secundario" onClick={() => onImportado(resultado.productos, true)}>
                    Reemplazar los {cantidadActual} actuales
                  </Boton>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <aside className="space-y-4 text-sm text-tinta-600">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-tinta-200">
          <div className="mb-2 font-semibold text-tinta-900">Cómo se lee cada formato</div>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>PDF:</b> cada foto de la página es un artículo; el texto más cercano a la foto da el código, nombre, descripción, precio,
              tallas y colores. Sirve con varios artículos por página.
            </li>
            <li>
              <b>Excel:</b> una fila por artículo con encabezados como <i>Código, Descripción, Precio, Tallas, Colores</i>. La foto pegada
              en la fila se toma como foto del artículo.
            </li>
            <li>Los PDF escaneados (sin texto seleccionable) no se pueden leer: hace falta el PDF original.</li>
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-tinta-200">
          <div className="mb-2 font-semibold text-tinta-900">No se inventan datos</div>
          Lo que el catálogo no trae queda vacío y marcado para revisión. El precio solo se toma si aparece con su moneda.
        </div>
      </aside>
    </div>
  );
}

function Revisar({ cat, setCat, reglas }: { cat: Catalogo; setCat: (f: (c: Catalogo | null) => Catalogo | null) => void; reglas: Reglas }) {
  const [soloAvisos, setSoloAvisos] = useState(false);
  const [filtro, setFiltro] = useState('');
  const entradaFotos = useRef<HTMLInputElement>(null);
  const [cargaFotos, setCargaFotos] = useState<{ hechas: number; total: number } | null>(null);
  const [resultadoFotos, setResultadoFotos] = useState<{ asignadas: number; sinAsignar: FotoSinAsignar[] } | null>(null);
  const fotos = useMemo(() => contarFotos(cat), [cat]);

  const cargarFotos = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setResultadoFotos(null);
    setCargaFotos({ hechas: 0, total: lista.length });
    try {
      const r = await aplicarFotos(cat.productos, [...lista], (hechas, total) => setCargaFotos({ hechas, total }));
      setCat((c) => c && { ...c, productos: r.productos });
      setResultadoFotos({ asignadas: r.asignadas, sinAsignar: r.sinAsignar });
    } finally {
      setCargaFotos(null);
    }
  };
  const lista = useMemo(
    () =>
      cat.productos.filter(
        (p) => (!soloAvisos || p.avisos.length) && (!filtro || `${p.codigo} ${p.nombre}`.toLowerCase().includes(filtro.toLowerCase())),
      ),
    [cat.productos, soloAvisos, filtro],
  );
  const cambiar = (id: string, cambios: Partial<Producto>) =>
    setCat((c) => c && { ...c, productos: c.productos.map((p) => (p.id === id ? { ...p, ...cambios } : p)) });

  if (cat.productos.length === 0) {
    return <div className="py-16 text-center text-sm text-tinta-500">Todavía no hay artículos. Importa un catálogo en el paso 1.</div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar por código o nombre"
          className="foco h-10 w-64 rounded-lg border border-tinta-200 bg-white px-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-tinta-600">
          <input type="checkbox" checked={soloAvisos} onChange={(e) => setSoloAvisos(e.target.checked)} className="accent-tinta-900" />
          Solo los que tienen avisos
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Boton variante="secundario" tamano="sm" disabled={!!cargaFotos} onClick={() => entradaFotos.current?.click()}>
            <ImagePlus className="h-4 w-4" /> {cargaFotos ? `Cargando fotos ${cargaFotos.hechas}/${cargaFotos.total}…` : 'Cargar fotos por código'}
          </Boton>
          <input
            ref={entradaFotos}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void cargarFotos(e.target.files);
              e.target.value = '';
            }}
          />
          <Boton
            variante="peligro"
            tamano="sm"
            disabled={fotos.total === 0 || !!cargaFotos}
            onClick={() => {
              if (confirm(`¿Quitar las ${fotos.total} fotos del borrador? Los códigos, nombres, tallas y colores se conservan.`)) {
                setCat((c) => c && { ...c, productos: quitarFotos(c.productos) });
                setResultadoFotos(null);
              }
            }}
          >
            <ImageOff className="h-4 w-4" /> Quitar todas las fotos
          </Boton>
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() =>
              setCat(
                (c) =>
                  c && {
                    ...c,
                    productos: [
                      {
                        id: nuevoId('prd'),
                        codigo: '',
                        nombre: 'Artículo nuevo',
                        descripcion: '',
                        categoria: categoriaDe('franela'),
                        forma: 'franela',
                        colores: [],
                        tallas: ['S', 'M', 'L', 'XL'],
                        precioCentavos: null,
                        minimo: 0,
                        foto: null,
                        origen: 'Creado a mano',
                        avisos: [],
                      },
                      ...c.productos,
                    ],
                  },
              )
            }
          >
            <Plus className="h-4 w-4" /> Artículo a mano
          </Boton>
        </div>
      </div>
      <p className="mb-4 text-xs text-tinta-500">
        Fotos nuevas: nómbralas con el código del artículo, por ejemplo <span className="font-mono">2800.jpg</span> (frente),{' '}
        <span className="font-mono">2800-espalda.jpg</span>, <span className="font-mono">2800-2.jpg</span> (detalles) y{' '}
        <span className="font-mono">2800-color-06.jpg</span> (la prenda en el color 06). Puedes seleccionarlas todas a la vez.
      </p>
      {resultadoFotos && (
        <div className="mb-4">
          <Aviso tono={resultadoFotos.sinAsignar.length ? 'aviso' : 'ok'}>
            {resultadoFotos.asignadas} fotos asignadas
            {resultadoFotos.sinAsignar.length > 0 && ` · ${resultadoFotos.sinAsignar.length} sin asignar:`}
            {resultadoFotos.sinAsignar.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {resultadoFotos.sinAsignar.map((x, i) => (
                  <li key={i}>
                    <span className="font-mono">{x.archivo}</span>: {x.motivo}
                  </li>
                ))}
              </ul>
            )}
          </Aviso>
        </div>
      )}
      <div className="space-y-3">
        {lista.map((p) => (
          <FichaEditable
            key={p.id}
            p={p}
            reglas={reglas}
            moneda={cat.ajustes.moneda}
            onCambio={(cambios) => cambiar(p.id, cambios)}
            onBorrar={() => setCat((c) => c && { ...c, productos: c.productos.filter((x) => x.id !== p.id) })}
          />
        ))}
      </div>
    </div>
  );
}

function FichaEditable({
  p,
  reglas,
  moneda,
  onCambio,
  onBorrar,
}: {
  p: Producto;
  reglas: Reglas;
  moneda: string;
  onCambio: (c: Partial<Producto>) => void;
  onBorrar: () => void;
}) {
  const precios = preciosDe(p);
  const hayGrandes = p.tallas.some((t) => esTallaGrande(t, reglas));
  const entradaFoto = useRef<HTMLInputElement>(null);
  const [tallasTxt, setTallasTxt] = useState(p.tallas.join(', '));
  const [nuevoColor, setNuevoColor] = useState({ nombre: '', hex: '#1f2a44' });

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-tinta-200 sm:p-5">
      <div className="grid gap-4 md:grid-cols-[150px_1fr]">
        <div>
          <button
            onClick={() => entradaFoto.current?.click()}
            className="foco group relative block aspect-square w-full overflow-hidden rounded-xl border border-tinta-200 bg-white"
            title="Cambiar foto"
          >
            <Foto src={p.foto} alt={p.nombre} className="h-full w-full p-2" />
            <span className="absolute inset-x-0 bottom-0 bg-tinta-900/80 py-1 text-center text-[11px] text-white opacity-0 group-hover:opacity-100">Cambiar foto</span>
          </button>
          <input
            ref={entradaFoto}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const foto = await normalizarFoto(f);
              onCambio({ foto: foto.dataUrl, avisos: p.avisos.filter((a) => !a.includes('foto')) });
              e.target.value = '';
            }}
          />
          <div className="mt-2 text-[11px] leading-snug text-tinta-400">{p.origen}</div>
        </div>
        <div className="space-y-3">
          {p.avisos.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {p.avisos.map((a) => (
                <Etiqueta key={a} tono="aviso">
                  {a}
                </Etiqueta>
              ))}
              <button onClick={() => onCambio({ avisos: [] })} className="text-xs text-tinta-500 underline hover:text-tinta-900">
                Marcar como revisado
              </button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Campo etiqueta="Código" value={p.codigo} onChange={(e) => onCambio({ codigo: e.target.value.toUpperCase() })} />
            <Campo etiqueta="Nombre" value={p.nombre} onChange={(e) => onCambio({ nombre: e.target.value })} />
          </div>
          <AreaTexto etiqueta="Descripción" valor={p.descripcion} onCambio={(v) => onCambio({ descripcion: v })} filas={2} />
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-tinta-600">Prenda 3D</span>
              <select
                value={p.forma}
                onChange={(e) => {
                  const forma = e.target.value as Forma3D;
                  onCambio({ forma, categoria: p.categoria === categoriaDe(p.forma) ? categoriaDe(forma) : p.categoria });
                }}
                className="foco h-10 w-full rounded-lg border border-tinta-200 bg-white px-2 text-sm"
              >
                {FORMAS_3D.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <Campo etiqueta="Categoría" value={p.categoria} onChange={(e) => onCambio({ categoria: e.target.value })} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-tinta-600">Tela</span>
              <select
                value={p.tela ?? ''}
                onChange={(e) => onCambio({ tela: e.target.value || undefined })}
                className="foco h-10 w-full rounded-lg border border-tinta-200 bg-white px-2 text-sm"
              >
                <option value="">Sin indicar (todas las técnicas)</option>
                {[...new Set([...reglas.telas, ...(p.tela ? [p.tela] : [])])].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <Campo
              etiqueta="Mínimo (uds)"
              type="number"
              min={0}
              value={p.minimo || ''}
              placeholder="Sin mínimo"
              onChange={(e) => onCambio({ minimo: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Tallas (separadas por coma)"
              value={tallasTxt}
              onChange={(e) => setTallasTxt(e.target.value)}
              onBlur={() => {
                const t = tallasTxt
                  .split(/[,;]+/)
                  .map((x) => x.trim())
                  .filter(Boolean);
                const leidas = t.length === 1 ? leerTallas(t[0]) ?? t : t;
                onCambio({ tallas: leidas.length ? leidas : ['Única'] });
                setTallasTxt((leidas.length ? leidas : ['Única']).join(', '));
              }}
            />
            <div>
              <span className="mb-1 block text-xs font-medium text-tinta-600">Colores</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {p.colores.map((c) => (
                  <span key={c.nombre} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-tinta-200 pl-1.5 pr-1 text-xs">
                    <input
                      type="color"
                      value={c.hex}
                      onChange={(e) => onCambio({ colores: p.colores.map((x) => (x.nombre === c.nombre ? { ...x, hex: e.target.value } : x)) })}
                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                      title="Ajustar tono"
                    />
                    {c.nombre}
                    <button onClick={() => onCambio({ colores: p.colores.filter((x) => x.nombre !== c.nombre) })} className="rounded p-0.5 text-tinta-400 hover:text-red-600" aria-label={`Quitar ${c.nombre}`}>
                      ×
                    </button>
                  </span>
                ))}
                <span className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-tinta-300 pl-1.5 pr-1">
                  <input type="color" value={nuevoColor.hex} onChange={(e) => setNuevoColor((n) => ({ ...n, hex: e.target.value }))} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
                  <input
                    value={nuevoColor.nombre}
                    onChange={(e) => setNuevoColor((n) => ({ ...n, nombre: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && nuevoColor.nombre.trim()) {
                        onCambio({ colores: [...p.colores, { nombre: nuevoColor.nombre.trim(), hex: nuevoColor.hex }] });
                        setNuevoColor({ nombre: '', hex: nuevoColor.hex });
                      }
                    }}
                    placeholder="Nuevo color ↵"
                    className="h-6 w-28 bg-transparent text-xs outline-none"
                  />
                </span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-medium text-tinta-600">Precio por unidad ({moneda})</span>
              <div className="grid grid-cols-3 gap-2">
                {NIVELES.map((n) => (
                  <label key={n.valor} className="block">
                    <span className="mb-0.5 block text-[11px] text-tinta-500">{n.etiqueta}</span>
                    <CampoPrecio
                      valor={precios[n.valor]}
                      etiqueta={`Precio ${n.etiqueta}`}
                      onCambio={(c) => onCambio({ precios: { ...precios, [n.valor]: c }, precioCentavos: n.valor === 'detal' ? c : precios.detal })}
                    />
                  </label>
                ))}
              </div>
              {hayGrandes && (
                <>
                  <span className="mb-0.5 mt-2 block text-[11px] text-tinta-500">
                    Tallas grandes: vacío = recargo de las reglas (
                    {reglas.tallasGrandes.tipo === 'porcentaje' ? `+${reglas.tallasGrandes.valor} %` : `+${formatoDinero(reglas.tallasGrandes.valor, moneda)}`})
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {NIVELES.map((n) => (
                      <CampoPrecio
                        key={n.valor}
                        valor={p.preciosGrandes?.[n.valor] ?? null}
                        etiqueta={`Precio tallas grandes ${n.etiqueta}`}
                        placeholder="Recargo"
                        onCambio={(c) => {
                          const g = { ...p.preciosGrandes, [n.valor]: c };
                          const vacio = NIVELES.every((x) => g[x.valor] === null || g[x.valor] === undefined);
                          onCambio({ preciosGrandes: vacio ? undefined : g });
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Boton variante="peligro" tamano="sm" onClick={onBorrar}>
              <Trash2 className="h-4 w-4" /> Quitar del catálogo
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}

function AjustesForm({ ajustes, onCambio }: { ajustes: Ajustes; onCambio: (a: Ajustes) => void }) {
  const set = <K extends keyof Ajustes>(k: K, v: Ajustes[K]) => onCambio({ ...ajustes, [k]: v });
  const entradaPortada = useRef<HTMLInputElement>(null);
  return (
    <div className="max-w-2xl space-y-4 rounded-2xl bg-white p-6 ring-1 ring-tinta-200">
      <div>
        <span className="mb-1 block text-xs font-medium text-tinta-600">Portada (imagen de la empresa arriba del catálogo)</span>
        {ajustes.portada && <img src={ajustes.portada} alt="Portada" className="mb-2 max-h-48 w-full rounded-lg object-cover ring-1 ring-tinta-200" />}
        <div className="flex gap-2">
          <Boton variante="secundario" tamano="sm" onClick={() => entradaPortada.current?.click()}>
            <ImagePlus className="h-4 w-4" /> {ajustes.portada ? 'Cambiar portada' : 'Subir portada'}
          </Boton>
          {ajustes.portada && (
            <Boton variante="peligro" tamano="sm" onClick={() => set('portada', null)}>
              Quitar portada
            </Boton>
          )}
        </div>
        <input
          ref={entradaPortada}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) set('portada', await reducirImagen(f));
            e.target.value = '';
          }}
        />
      </div>
      <Campo etiqueta="Nombre de la empresa" value={ajustes.empresa} onChange={(e) => set('empresa', e.target.value)} />
      <Campo etiqueta="Lema" value={ajustes.lema} onChange={(e) => set('lema', e.target.value)} />
      <Campo
        etiqueta="WhatsApp general"
        value={ajustes.whatsappAsesor}
        onChange={(e) => set('whatsappAsesor', e.target.value.replace(/[^\d+]/g, ''))}
        placeholder="584141234567"
        ayuda="Con código de país. Recibe los pedidos cuando no hay sucursales ni vendedores cargados."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="PIN del panel"
          value={ajustes.pin ?? '1234'}
          inputMode="numeric"
          onChange={(e) => set('pin', e.target.value.replace(/\s/g, '') || '1234')}
          ayuda="Evita que un cliente entre por curiosidad. No es una contraseña segura."
        />
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" checked={!!ajustes.datosDePrueba} onChange={(e) => set('datosDePrueba', e.target.checked)} className="h-4 w-4 accent-tinta-900" />
          Avisar a los clientes que los precios y las telas son de prueba
        </label>
      </div>
      <Campo etiqueta="Correo del asesor (opcional)" type="email" value={ajustes.correoAsesor} onChange={(e) => set('correoAsesor', e.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-tinta-600">Moneda</span>
          <select value={ajustes.moneda} onChange={(e) => set('moneda', e.target.value)} className="foco h-10 w-full rounded-lg border border-tinta-200 bg-white px-2 text-sm">
            <option value="USD">Dólares (USD)</option>
            <option value="VES">Bolívares (VES)</option>
            <option value="EUR">Euros (EUR)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" checked={ajustes.mostrarPrecios} onChange={(e) => set('mostrarPrecios', e.target.checked)} className="h-4 w-4 accent-tinta-900" />
          Mostrar precios a los clientes
        </label>
      </div>
    </div>
  );
}

function Publicar({ cat, setCat }: { cat: Catalogo; setCat: (f: (c: Catalogo | null) => Catalogo | null) => void }) {
  const [hecho, setHecho] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const sinCodigo = cat.productos.filter((p) => !p.codigo).length;
  const sinFoto = cat.productos.filter((p) => !p.foto).length;
  const pesoMb = useMemo(() => new Blob([JSON.stringify(cat)]).size / 1024 / 1024, [cat]);
  const [armando, setArmando] = useState(false);

  const publicado = (): Catalogo => ({
    ...cat,
    reglas: reglasCompletas(cat.reglas),
    publicadoEn: new Date().toISOString(),
    productos: cat.productos.map((p) => ({ ...p, avisos: [] })),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-4">
        {(sinCodigo > 0 || sinFoto > 0 || !cat.ajustes.whatsappAsesor) && (
          <Aviso tono="aviso">
            {[
              sinCodigo && `${sinCodigo} artículos sin código`,
              sinFoto && `${sinFoto} sin foto`,
              !cat.ajustes.whatsappAsesor && 'falta el WhatsApp del asesor (paso 3)',
            ]
              .filter(Boolean)
              .join(' · ')}
            . Puedes publicar igual, pero conviene revisarlo.
          </Aviso>
        )}
        <div className="rounded-2xl bg-white p-6 ring-1 ring-tinta-200">
          <div className="text-base font-semibold">Vista previa en este navegador</div>
          <p className="mt-1 text-sm text-tinta-600">Publica el borrador aquí para verlo como lo verá el cliente antes de subirlo.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Boton
              onClick={async () => {
                await almacen.guardarPublicadoLocal(publicado());
                setHecho('Listo: el catálogo de este navegador ya muestra el borrador.');
              }}
            >
              <Eye className="h-4 w-4" /> Publicar en este navegador
            </Boton>
            <button onClick={() => ir('tienda')} className="foco inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-tinta-700 hover:bg-tinta-100">
              Abrir el catálogo
            </button>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 ring-1 ring-tinta-200">
          <div className="text-base font-semibold">Publicar para los clientes</div>
          <p className="mt-1 text-sm text-tinta-600">
            Descarga <span className="font-mono">catalogo.zip</span> (unos {pesoMb.toFixed(1)} MB) y descomprímelo en la carpeta{' '}
            <span className="font-mono">public/</span> del sitio (o junto al <span className="font-mono">index.html</span> publicado): trae{' '}
            <span className="font-mono">catalogo.json</span> y la carpeta <span className="font-mono">fotos/</span>, con cada foto nombrada por su código.
            Todos los clientes verán ese catálogo.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Boton
              disabled={armando}
              onClick={async () => {
                setArmando(true);
                try {
                  const { zip, avisos } = await armarPaquete(publicado());
                  descargar(zip, 'catalogo.zip');
                  setHecho(avisos.length ? avisos.join(' ') : 'Listo: se descargó catalogo.zip.');
                } finally {
                  setArmando(false);
                }
              }}
            >
              <Download className="h-4 w-4" /> {armando ? 'Preparando…' : 'Descargar catalogo.zip'}
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => {
                const conf = exportarConfiguracion(cat);
                descargar(new Blob([JSON.stringify(conf, null, 2)], { type: 'application/json' }), `configuracion-${conf.exportadoEn.slice(0, 10)}.json`);
                setHecho('Se descargó la configuración: reglas, sucursales, precios y telas (sin fotos).');
              }}
            >
              <Settings2 className="h-4 w-4" /> Exportar configuración (JSON)
            </Boton>
            <Boton variante="secundario" onClick={() => entrada.current?.click()}>
              <Upload className="h-4 w-4" /> Importar (.zip o .json)
            </Boton>
            <input
              ref={entrada}
              type="file"
              accept="application/json,.json,application/zip,.zip"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (/\.json$/i.test(f.name)) {
                    const j = JSON.parse(await f.text());
                    if (esConfiguracion(j)) {
                      const r = aplicarConfiguracion(cat, j);
                      setCat(() => r.catalogo);
                      setHecho(
                        `Configuración aplicada: ${r.actualizados} artículos actualizados.` +
                          (r.sinArticulo.length ? ` Códigos que no están en el catálogo: ${r.sinArticulo.join(', ')}.` : ''),
                      );
                      e.target.value = '';
                      return;
                    }
                  }
                  const { catalogo, avisos } = await abrirPaquete(f);
                  setCat(() => catalogo);
                  setHecho([`Se abrió «${f.name}» con ${catalogo.productos.length} artículos.`, ...avisos].join(' '));
                } catch (err) {
                  setHecho((err as Error).message || 'Ese archivo no es un catálogo válido.');
                }
                e.target.value = '';
              }}
            />
          </div>
        </div>
        {hecho && <Aviso tono="ok">{hecho}</Aviso>}
      </div>
      <aside className="rounded-2xl bg-white p-5 text-sm text-tinta-600 ring-1 ring-tinta-200">
        <div className="mb-2 font-semibold text-tinta-900">Resumen</div>
        <ul className="space-y-1">
          <li>{cat.productos.length} artículos</li>
          <li>{new Set(cat.productos.map((p) => p.categoria)).size} categorías</li>
          <li>{cat.productos.filter((p) => p.precioCentavos !== null).length} con precio</li>
          <li>Precios {cat.ajustes.mostrarPrecios ? 'visibles' : 'ocultos'} para el cliente</li>
          <li>Órdenes a: {cat.ajustes.whatsappAsesor || '—'}</li>
        </ul>
        <div className="mt-4 border-t border-tinta-100 pt-4">
          <Boton
            variante="peligro"
            tamano="sm"
            onClick={() => {
              if (confirm('¿Vaciar el borrador? Los artículos importados se borran de este navegador.')) setCat((c) => c && { ...c, productos: [] });
            }}
          >
            <Trash2 className="h-4 w-4" /> Vaciar borrador
          </Boton>
        </div>
      </aside>
    </div>
  );
}
