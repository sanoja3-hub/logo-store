// Navegación entre catálogo y panel. Usa `#admin` (sin barra) para que funcione también dentro de
// visores que solo aceptan anclas simples, y avisa por un evento propio por si el ancla no cambia.
export type Ruta = 'tienda' | 'admin';

export function rutaActual(): Ruta {
  return /^#\/?admin/.test(window.location.hash) ? 'admin' : 'tienda';
}

export function ir(ruta: Ruta) {
  try {
    window.location.hash = ruta === 'admin' ? 'admin' : 'catalogo';
  } catch {
    // algunos visores no dejan cambiar el ancla
  }
  window.dispatchEvent(new CustomEvent<Ruta>('atelier:ruta', { detail: ruta }));
  window.scrollTo(0, 0);
}
