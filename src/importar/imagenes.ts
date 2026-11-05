// Utilidades de imagen del navegador: recortar el fondo, reducir y comprimir fotos de catálogo.

export interface FotoNormalizada {
  dataUrl: string;
  /** Color predominante de la prenda (sin el fondo), en hex. */
  colorHex: string | null;
}

function lienzo(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export async function cargarImagen(fuente: Blob | string): Promise<HTMLImageElement> {
  const url = typeof fuente === 'string' ? fuente : URL.createObjectURL(fuente);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    if (typeof fuente !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function cercano(a: number[], b: number[], tol: number): boolean {
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
}

/** Busca el rectángulo que ocupa la prenda descartando bordes del color del fondo. */
function cajaContenido(datos: ImageData): { x: number; y: number; w: number; h: number; fondo: number[] } {
  const { width: w, height: h, data } = datos;
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const esquinas = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
  const fondo = esquinas[0];
  const fondoUniforme = esquinas.every((e) => cercano(e, fondo, 18));
  if (!fondoUniforme) return { x: 0, y: 0, w, h, fondo };
  const esFondo = (x: number, y: number) => {
    const p = px(x, y);
    return p[3] < 20 || cercano(p, fondo, 22);
  };
  let x0 = 0, x1 = w - 1, y0 = 0, y1 = h - 1;
  const filaVacia = (y: number) => { for (let x = 0; x < w; x += 2) if (!esFondo(x, y)) return false; return true; };
  const colVacia = (x: number) => { for (let y = y0; y <= y1; y += 2) if (!esFondo(x, y)) return false; return true; };
  while (y0 < y1 && filaVacia(y0)) y0++;
  while (y1 > y0 && filaVacia(y1)) y1--;
  while (x0 < x1 && colVacia(x0)) x0++;
  while (x1 > x0 && colVacia(x1)) x1--;
  const margen = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - margen); y0 = Math.max(0, y0 - margen);
  x1 = Math.min(w - 1, x1 + margen); y1 = Math.min(h - 1, y1 + margen);
  if (x1 - x0 < w * 0.1 || y1 - y0 < h * 0.1) return { x: 0, y: 0, w, h, fondo };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, fondo };
}

/** Color predominante ignorando el fondo: agrupa los píxeles en cubos de color y toma el más poblado. */
function colorPredominante(datos: ImageData, fondo: number[]): string | null {
  const { data } = datos;
  const cubos = new Map<number, { n: number; r: number; g: number; b: number }>();
  const paso = Math.max(4, Math.floor(data.length / 4 / 40000)) * 4;
  for (let i = 0; i < data.length; i += paso) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (cercano([r, g, b], fondo, 30)) continue;
    const clave = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const c = cubos.get(clave) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += r; c.g += g; c.b += b;
    cubos.set(clave, c);
  }
  let mejor: { n: number; r: number; g: number; b: number } | null = null;
  for (const c of cubos.values()) if (!mejor || c.n > mejor.n) mejor = c;
  if (!mejor || mejor.n < 30) return null;
  const hex = (v: number) => Math.round(v / mejor!.n).toString(16).padStart(2, '0');
  return `#${hex(mejor.r)}${hex(mejor.g)}${hex(mejor.b)}`;
}

/** Recorta el fondo, reduce a `maxLado` píxeles y comprime en WebP (o JPEG si el navegador no tiene WebP). */
export function normalizarDesdeLienzo(origen: CanvasImageSource, w: number, h: number, maxLado = 900): FotoNormalizada {
  const base = lienzo(w, h);
  const ctx = base.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(origen, 0, 0, w, h);
  const datos = ctx.getImageData(0, 0, base.width, base.height);
  const caja = cajaContenido(datos);
  const recorte = ctx.getImageData(caja.x, caja.y, caja.w, caja.h);
  const colorHex = colorPredominante(recorte, caja.fondo);

  const escala = Math.min(1, maxLado / Math.max(caja.w, caja.h));
  const salida = lienzo(caja.w * escala, caja.h * escala);
  const sctx = salida.getContext('2d')!;
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, salida.width, salida.height);
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(base, caja.x, caja.y, caja.w, caja.h, 0, 0, salida.width, salida.height);
  let dataUrl = salida.toDataURL('image/webp', 0.86);
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = salida.toDataURL('image/jpeg', 0.88);
  return { dataUrl, colorHex };
}

export async function normalizarFoto(fuente: Blob | string, maxLado = 900): Promise<FotoNormalizada> {
  const img = await cargarImagen(fuente);
  return normalizarDesdeLienzo(img, img.naturalWidth, img.naturalHeight, maxLado);
}

/** Nombre aproximado de un color hex, para cuando el catálogo no lo dice. */
export function nombreDeColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
  if (l > 0.88) return 'Blanco';
  if (l < 0.14) return 'Negro';
  if (s < 0.15) return l > 0.6 ? 'Gris claro' : l > 0.35 ? 'Gris' : 'Gris oscuro';
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue < 15 || hue >= 345) return l < 0.3 ? 'Vinotinto' : 'Rojo';
  if (hue < 40) return l < 0.35 ? 'Marrón' : 'Naranja';
  if (hue < 65) return l < 0.5 ? 'Kaki' : 'Amarillo';
  if (hue < 165) return 'Verde';
  if (hue < 200) return 'Turquesa';
  if (hue < 255) return l < 0.3 ? 'Azul marino' : 'Azul';
  if (hue < 300) return 'Morado';
  return 'Rosado';
}
