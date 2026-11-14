// Catálogo publicado como paquete .zip: `catalogo.json` liviano y las fotos como archivos en `fotos/`.
// También aplica al borrador las fotos nuevas cargadas por código (ver core/fotos.ts).

import JSZip from 'jszip';
import { CARPETA_FOTOS, esDataUrl, mapearFotos, reconocerFotos, type FotoSinAsignar } from '../core/fotos';
import { esCatalogo } from '../core/almacen';
import type { Catalogo, Producto } from '../core/modelo';
import { normalizarFoto } from './imagenes';

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/avif': 'avif', 'image/gif': 'gif' };
const MIME: Record<string, string> = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));

async function aBlob(foto: string): Promise<Blob> {
  const r = await fetch(foto);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.blob();
}

function aDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result));
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(b);
  });
}

/** Arma el .zip para publicar: las fotos salen del JSON y quedan como archivos en `fotos/`. */
export async function armarPaquete(cat: Catalogo): Promise<{ zip: Blob; avisos: string[] }> {
  const zip = new JSZip();
  const avisos: string[] = [];
  const usados = new Set<string>();
  const productos: Producto[] = [];
  for (const p of cat.productos) {
    productos.push(
      await mapearFotos(p, async (foto, nombre) => {
        try {
          const blob = await aBlob(foto);
          let ruta = `${CARPETA_FOTOS}/${nombre}.${EXT[blob.type] ?? 'webp'}`;
          for (let n = 2; usados.has(ruta); n++) ruta = `${CARPETA_FOTOS}/${nombre}_${n}.${EXT[blob.type] ?? 'webp'}`;
          usados.add(ruta);
          zip.file(ruta, blob);
          return ruta;
        } catch {
          avisos.push(`No se pudo leer una foto de ${p.codigo || p.nombre}: se publica sin ella.`);
          return null;
        }
      }),
    );
  }
  zip.file('catalogo.json', JSON.stringify({ ...cat, productos }));
  return { zip: await zip.generateAsync({ type: 'blob' }), avisos };
}

/** Abre un catálogo publicado (.zip con fotos o catalogo.json) y vuelve a meter las fotos para editarlo. */
export async function abrirPaquete(archivo: File): Promise<{ catalogo: Catalogo; avisos: string[] }> {
  const avisos: string[] = [];
  if (/\.json$/i.test(archivo.name) || archivo.type === 'application/json') {
    const j = JSON.parse(await archivo.text());
    if (!esCatalogo(j)) throw new Error('Ese archivo no es un catálogo válido.');
    const sueltas = j.productos.some((p) => p.foto && !esDataUrl(p.foto));
    if (sueltas) avisos.push('Este catalogo.json enlaza fotos sueltas: si no se ven, abre el .zip completo.');
    return { catalogo: j, avisos };
  }
  const zip = await JSZip.loadAsync(archivo);
  const entrada = zip.file(/(^|\/)catalogo\.json$/i)[0];
  if (!entrada) throw new Error('El .zip no trae catalogo.json.');
  const raiz = entrada.name.replace(/catalogo\.json$/i, '');
  const j = JSON.parse(await entrada.async('string'));
  if (!esCatalogo(j)) throw new Error('El catalogo.json del .zip no es un catálogo válido.');
  const productos = await Promise.all(
    j.productos.map((p) =>
      mapearFotos(p, async (foto) => {
        if (esDataUrl(foto)) return foto;
        const f = zip.file(raiz + foto.replace(/^\.?\//, ''));
        if (!f) {
          avisos.push(`Falta ${foto} en el .zip.`);
          return null;
        }
        const ext = foto.split('.').pop()?.toLowerCase() ?? '';
        return aDataUrl(new Blob([await f.async('arraybuffer')], { type: MIME[ext] ?? 'image/webp' }));
      }),
    ),
  );
  return { catalogo: { ...j, productos }, avisos };
}

/**
 * Pone en el borrador las fotos nuevas según su nombre (código del artículo). Reemplaza solo lo que trae:
 * si llega el frente, cambia el frente; si llegan detalles, reemplazan a los anteriores.
 */
export async function aplicarFotos(
  productos: Producto[],
  archivos: File[],
  avance: (hechas: number, total: number) => void,
): Promise<{ productos: Producto[]; asignadas: number; sinAsignar: FotoSinAsignar[] }> {
  const { asignadas, sinAsignar } = reconocerFotos(
    archivos.map((a) => a.name),
    productos,
  );
  const porNombre = new Map(archivos.map((a) => [a.name, a]));
  const nuevos = new Map(productos.map((p) => [p.id, { ...p, colores: p.colores.map((c) => ({ ...c })) }]));
  const detalles = new Map<string, { orden: number; foto: string }[]>();
  let hechas = 0;
  let ok = 0;
  for (const a of asignadas) {
    const p = nuevos.get(a.productoId)!;
    try {
      const { dataUrl } = await normalizarFoto(porNombre.get(a.archivo)!, a.rol === 'color' ? 240 : 900);
      if (a.rol === 'frente') {
        p.foto = dataUrl;
        p.avisos = p.avisos.filter((x) => !x.includes('foto'));
      } else if (a.rol === 'espalda') p.fotoEspalda = dataUrl;
      else if (a.rol === 'detalle') detalles.set(p.id, [...(detalles.get(p.id) ?? []), { orden: a.orden, foto: dataUrl }]);
      else {
        const c = p.colores.find((x) => x.nombre === a.color);
        if (c) c.foto = dataUrl;
      }
      ok++;
    } catch {
      sinAsignar.push({ archivo: a.archivo, motivo: 'La imagen está dañada o el navegador no la puede abrir.' });
    }
    avance(++hechas, asignadas.length);
  }
  for (const [id, lista] of detalles) nuevos.get(id)!.fotos = lista.sort((x, y) => x.orden - y.orden).map((x) => x.foto);
  return { productos: productos.map((p) => nuevos.get(p.id)!), asignadas: ok, sinAsignar };
}
