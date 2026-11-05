import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { CheckCircle2, FileSpreadsheet, FileText, ImagePlus, Pencil, Send, Trash2 } from 'lucide-react';
import { formatoDinero } from '../core/dinero';
import { totalUnidades, type Ajustes, type Cliente, type LineaPedido, type LogoCliente } from '../core/modelo';
import { descargar, nombreArchivo, ordenExcel, ordenPdf, type DatosOrden } from '../pedido/documentos';
import { detalleTallas, enlaceWhatsApp, faltantesCliente, mensajeWhatsApp, numeroOrden, subtotal, textoLogo, totales } from '../pedido/orden';
import { AreaTexto, Aviso, Boton, Campo, Foto, PanelLateral } from '../ui/comunes';
import { leerLogo } from './logo';

export function PanelPedido({
  abierto,
  onCerrar,
  lineas,
  setLineas,
  cliente,
  setCliente,
  logo,
  setLogo,
  ajustes,
  onEditar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  lineas: LineaPedido[];
  setLineas: Dispatch<SetStateAction<LineaPedido[]>>;
  cliente: Cliente;
  setCliente: Dispatch<SetStateAction<Cliente>>;
  logo: LogoCliente | null;
  setLogo: (l: LogoCliente | null) => void;
  ajustes: Ajustes;
  onEditar: (l: LineaPedido) => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avisosLogo, setAvisosLogo] = useState<string[]>([]);
  const [enviada, setEnviada] = useState<{ numero: string; compartido: boolean } | null>(null);
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const entradaLogo = useRef<HTMLInputElement>(null);
  const t = totales(lineas);
  const faltan = faltantesCliente(cliente);
  const campo = (k: keyof Cliente) => ({
    value: cliente[k],
    onChange: (e: { target: { value: string } }) => setCliente((c) => ({ ...c, [k]: e.target.value })),
  });

  const datos = (numero: string): DatosOrden => ({ numero, fecha: new Date(), lineas, cliente, logo, ajustes });

  const conOcupado = async (que: string, fn: () => Promise<void>) => {
    setOcupado(que);
    setError(null);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError('No se pudo generar el documento. Inténtalo de nuevo.');
    } finally {
      setOcupado(null);
    }
  };

  const enviar = () =>
    conOcupado('enviar', async () => {
      setIntentoEnviar(true);
      if (faltan.length) {
        setError(`Completa: ${faltan.join(', ')}.`);
        return;
      }
      const numero = numeroOrden();
      const d = datos(numero);
      const pdf = await ordenPdf(d);
      const texto = mensajeWhatsApp(numero, lineas, cliente, logo, ajustes);
      const archivos = [new File([pdf], nombreArchivo(d, 'pdf'), { type: 'application/pdf' })];
      if (logo) {
        const b = await (await fetch(logo.dataUrl)).blob();
        archivos.push(new File([b], logo.nombreArchivo, { type: b.type }));
      }
      // En el teléfono se comparte la orden en PDF y el logo directo a WhatsApp; en la computadora se descarga
      // la orden y se abre WhatsApp con el resumen, para adjuntarla.
      const movil = /Android|iPhone|iPad/i.test(navigator.userAgent);
      if (movil && navigator.canShare?.({ files: archivos })) {
        try {
          await navigator.share({ files: archivos, text: texto, title: `Orden ${numero}` });
          setEnviada({ numero, compartido: true });
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      descargar(pdf, nombreArchivo(d, 'pdf'));
      window.open(enlaceWhatsApp(ajustes.whatsappAsesor, texto), '_blank', 'noopener');
      setEnviada({ numero, compartido: false });
    });

  const subirLogo = async (f: File | undefined) => {
    if (!f) return;
    const r = await leerLogo(f);
    if (r.error) setError(r.error);
    setAvisosLogo(r.avisos);
    if (r.logo) setLogo(r.logo);
  };

  const cerrar = () => {
    setEnviada(null);
    setError(null);
    onCerrar();
  };

  if (enviada) {
    return (
      <PanelLateral abierto={abierto} onCerrar={cerrar} titulo="Orden generada">
        <div className="px-6 py-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <div className="mt-3 text-lg font-semibold">Orden {enviada.numero}</div>
          <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-600">
            {enviada.compartido
              ? 'Compartiste la orden en PDF y tu logo. Tu asesor la revisará y te contactará para confirmar.'
              : 'Se descargó la orden en PDF y se abrió WhatsApp con el resumen. Adjunta el PDF en el chat con tu asesor para que tenga las fotos, tallas y tu logo.'}
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Boton
              variante="secundario"
              onClick={() =>
                conOcupado('pdf', async () => descargar(await ordenPdf(datos(enviada.numero)), nombreArchivo(datos(enviada.numero), 'pdf')))
              }
            >
              <FileText className="h-4 w-4" /> Descargar el PDF otra vez
            </Boton>
            <Boton
              variante="fantasma"
              onClick={() => {
                setLineas([]);
                setEnviada(null);
                onCerrar();
              }}
            >
              Empezar un pedido nuevo
            </Boton>
          </div>
        </div>
      </PanelLateral>
    );
  }

  return (
    <PanelLateral
      abierto={abierto}
      onCerrar={cerrar}
      titulo={
        <span>
          Mi pedido <span className="ml-1 font-normal text-tinta-500">· {t.unidades} unidades</span>
        </span>
      }
      pie={
        lineas.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div className="text-sm text-tinta-600">
                {lineas.length} {lineas.length === 1 ? 'artículo' : 'artículos'} · {t.unidades} unidades
              </div>
              {ajustes.mostrarPrecios && t.montoCentavos > 0 && (
                <div className="text-right">
                  <div className="text-xl font-semibold">{formatoDinero(t.montoCentavos, ajustes.moneda)}</div>
                  <div className="text-[11px] text-tinta-500">{t.completo ? 'Referencial, sin impuestos' : 'Sin incluir artículos sin precio'}</div>
                </div>
              )}
            </div>
            {error && <Aviso tono="error">{error}</Aviso>}
            <Boton variante="exito" tamano="lg" className="w-full" onClick={enviar} disabled={!!ocupado}>
              <Send className="h-4 w-4" />
              {ocupado === 'enviar' ? 'Preparando la orden…' : 'Enviar orden al asesor por WhatsApp'}
            </Boton>
            <div className="grid grid-cols-2 gap-2">
              <Boton
                variante="secundario"
                disabled={!!ocupado}
                onClick={() =>
                  conOcupado('pdf', async () => {
                    const d = datos(numeroOrden());
                    descargar(await ordenPdf(d), nombreArchivo(d, 'pdf'));
                  })
                }
              >
                <FileText className="h-4 w-4" /> {ocupado === 'pdf' ? 'Generando…' : 'Orden en PDF'}
              </Boton>
              <Boton
                variante="secundario"
                disabled={!!ocupado}
                onClick={() =>
                  conOcupado('xlsx', async () => {
                    const d = datos(numeroOrden());
                    descargar(await ordenExcel(d), nombreArchivo(d, 'xlsx'));
                  })
                }
              >
                <FileSpreadsheet className="h-4 w-4" /> {ocupado === 'xlsx' ? 'Generando…' : 'Orden en Excel'}
              </Boton>
            </div>
          </div>
        )
      }
    >
      {lineas.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="text-base font-semibold">Tu pedido está vacío</div>
          <p className="mt-1 text-sm text-tinta-500">Abre un artículo del catálogo, indica las tallas y agrégalo aquí.</p>
          <Boton variante="secundario" className="mt-5" onClick={cerrar}>
            Ver catálogo
          </Boton>
        </div>
      ) : (
        <div className="divide-y divide-tinta-100">
          <section className="px-5 py-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-tinta-500">Artículos</h3>
            <ul className="space-y-3">
              {lineas.map((l) => {
                const st = subtotal(l);
                return (
                  <li key={l.id} className="flex gap-3 rounded-xl border border-tinta-200 p-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-tinta-50">
                      <Foto src={l.vista3d ?? l.foto} alt={l.nombre} className="h-full w-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] text-tinta-500">{l.codigo || 'Sin código'}</div>
                          <div className="truncate text-sm font-medium">{l.nombre}</div>
                        </div>
                        <div className="flex shrink-0">
                          <button onClick={() => onEditar(l)} className="foco rounded-md p-1.5 text-tinta-500 hover:bg-tinta-100" aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setLineas((ls) => ls.filter((x) => x.id !== l.id))}
                            className="foco rounded-md p-1.5 text-tinta-500 hover:bg-red-50 hover:text-red-700"
                            aria-label="Quitar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-tinta-600">
                        {l.color && (
                          <span className="mr-2 inline-flex items-center gap-1">
                            <span className="h-2.5 w-2.5 rounded-full ring-1 ring-tinta-200" style={{ background: l.color.hex }} />
                            {l.color.nombre}
                          </span>
                        )}
                        {textoLogo(l)}
                      </div>
                      <div className="mt-1 text-xs text-tinta-500">{detalleTallas(l)}</div>
                      <div className="mt-1.5 flex justify-between text-sm">
                        <span className="font-medium">{totalUnidades(l)} uds</span>
                        {ajustes.mostrarPrecios && st !== null && <span className="font-semibold">{formatoDinero(st, ajustes.moneda)}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="px-5 py-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-tinta-500">Logo de la empresa</h3>
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
              <div className="flex items-center gap-3 rounded-lg border border-tinta-200 p-2">
                <div className="grid h-14 w-14 place-items-center rounded-md bg-[conic-gradient(#eef1f5_25%,#fff_0_50%,#eef1f5_0_75%,#fff_0)] bg-[length:12px_12px]">
                  <img src={logo.dataUrl} alt="Logo" className="max-h-12 max-w-12 object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{logo.nombreArchivo}</div>
                  <div className="text-xs text-tinta-500">
                    {logo.ancho}×{logo.alto} px · se adjunta a la orden
                  </div>
                </div>
                <Boton variante="fantasma" tamano="sm" onClick={() => entradaLogo.current?.click()}>
                  Cambiar
                </Boton>
                <Boton variante="peligro" tamano="sm" onClick={() => setLogo(null)}>
                  Quitar
                </Boton>
              </div>
            ) : (
              <button
                onClick={() => entradaLogo.current?.click()}
                className="foco flex w-full items-center gap-3 rounded-lg border border-dashed border-tinta-300 px-4 py-3 text-left hover:border-tinta-500 hover:bg-tinta-50"
              >
                <ImagePlus className="h-5 w-5 text-tinta-500" />
                <span className="text-sm">
                  <span className="font-medium">Subir logo en PNG</span>
                  <span className="block text-xs text-tinta-500">Con fondo transparente y buena resolución, si es posible.</span>
                </span>
              </button>
            )}
            {avisosLogo.length > 0 && (
              <div className="mt-2">
                <Aviso tono="aviso">{avisosLogo.join(' ')}</Aviso>
              </div>
            )}
          </section>

          <section className="px-5 py-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-tinta-500">Datos de la empresa</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Empresa *" {...campo('empresa')} placeholder="Razón social" className={intentoEnviar && !cliente.empresa.trim() ? '[&_input]:border-red-400' : ''} />
              <Campo etiqueta="RIF" {...campo('rif')} placeholder="J-12345678-9" />
              <Campo etiqueta="Persona de contacto *" {...campo('contacto')} className={intentoEnviar && !cliente.contacto.trim() ? '[&_input]:border-red-400' : ''} />
              <Campo
                etiqueta="Teléfono / WhatsApp *"
                type="tel"
                {...campo('telefono')}
                placeholder="0414 123 4567"
                className={intentoEnviar && cliente.telefono.replace(/\D/g, '').length < 7 ? '[&_input]:border-red-400' : ''}
              />
              <Campo etiqueta="Correo" type="email" {...campo('correo')} />
              <Campo etiqueta="Ciudad de entrega" {...campo('ciudad')} />
            </div>
            <div className="mt-3">
              <AreaTexto
                etiqueta="Notas para el asesor"
                valor={cliente.notas}
                onCambio={(v) => setCliente((c) => ({ ...c, notas: v }))}
                placeholder="Fecha requerida, forma de pago, colores de hilo…"
                filas={2}
              />
            </div>
          </section>
        </div>
      )}
    </PanelLateral>
  );
}
