import type { LogoCliente } from '../core/modelo';

const MAX_BYTES = 8 * 1024 * 1024;

export interface ResultadoLogo {
  logo: LogoCliente | null;
  error?: string;
  avisos: string[];
}

/** Primera página de un PDF como PNG con fondo transparente (para ver el logo vectorial sobre la prenda). */
async function pdfAPng(archivo: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
  const pagina = await doc.getPage(1);
  const base = pagina.getViewport({ scale: 1 });
  const viewport = pagina.getViewport({ scale: Math.min(4, 1400 / Math.max(base.width, base.height)) });
  const c = document.createElement('canvas');
  c.width = Math.ceil(viewport.width);
  c.height = Math.ceil(viewport.height);
  await pagina.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport, background: 'rgba(0,0,0,0)' }).promise;
  void doc.cleanup?.();
  return c.toDataURL('image/png');
}

/** Lee el logo del cliente: PNG (ideal, con fondo transparente), JPG o PDF; avisa si la resolución es baja. */
export async function leerLogo(archivo: File): Promise<ResultadoLogo> {
  const avisos: string[] = [];
  const esPdf = archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name);
  if (!esPdf && !/^image\/(png|jpeg)$/.test(archivo.type)) {
    return { logo: null, avisos, error: 'El logo debe ser PNG, JPG o PDF.' };
  }
  if (archivo.size > MAX_BYTES) {
    return { logo: null, avisos, error: 'El archivo pesa más de 8 MB. Expórtalo más liviano e inténtalo de nuevo.' };
  }
  let dataUrl: string;
  try {
    dataUrl = esPdf
      ? await pdfAPng(archivo)
      : await new Promise<string>((ok, mal) => {
          const r = new FileReader();
          r.onload = () => ok(r.result as string);
          r.onerror = () => mal(r.error);
          r.readAsDataURL(archivo);
        });
  } catch {
    return { logo: null, avisos, error: 'No se pudo leer el archivo. Si es un PDF, revisa que no tenga contraseña.' };
  }
  if (esPdf) avisos.push('Se muestra la primera página del PDF. Envía el PDF original al asesor por WhatsApp.');
  const img = new Image();
  img.src = dataUrl;
  try {
    await img.decode();
  } catch {
    return { logo: null, avisos, error: 'No se pudo abrir la imagen. Revisa que el archivo no esté dañado.' };
  }
  const ancho = img.naturalWidth;
  const alto = img.naturalHeight;

  // ¿Tiene píxeles transparentes? (revisión sobre una copia reducida)
  let tieneTransparencia = false;
  if (archivo.type === 'image/png' || esPdf) {
    const k = Math.min(1, 256 / Math.max(ancho, alto));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(ancho * k));
    c.height = Math.max(1, Math.round(alto * k));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 250) {
        tieneTransparencia = true;
        break;
      }
    }
  }
  if (!tieneTransparencia) avisos.push('El logo no tiene fondo transparente: en la prenda se verá con su fondo.');
  if (Math.max(ancho, alto) < 500) avisos.push(`Resolución baja (${ancho}×${alto} px). Para bordado o estampado conviene 1000 px o más.`);

  return {
    logo: { nombreArchivo: archivo.name, dataUrl, ancho, alto, tieneTransparencia },
    avisos,
  };
}
