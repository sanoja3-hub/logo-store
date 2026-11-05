import type { LogoCliente } from '../core/modelo';

const MAX_BYTES = 8 * 1024 * 1024;

export interface ResultadoLogo {
  logo: LogoCliente | null;
  error?: string;
  avisos: string[];
}

/** Lee el logo del cliente: acepta PNG (ideal, con fondo transparente) y JPG; avisa si la resolución es baja. */
export async function leerLogo(archivo: File): Promise<ResultadoLogo> {
  const avisos: string[] = [];
  if (!/^image\/(png|jpeg)$/.test(archivo.type)) {
    return { logo: null, avisos, error: 'El logo debe ser una imagen PNG (o JPG).' };
  }
  if (archivo.size > MAX_BYTES) {
    return { logo: null, avisos, error: 'El archivo pesa más de 8 MB. Expórtalo más liviano e inténtalo de nuevo.' };
  }
  const dataUrl = await new Promise<string>((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = () => mal(r.error);
    r.readAsDataURL(archivo);
  });
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
  if (archivo.type === 'image/png') {
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
