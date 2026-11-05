import { lazy, Suspense, useEffect, useState } from 'react';
import { Tienda } from './tienda/Tienda';
import { rutaActual, type Ruta } from './ruta';

const Admin = lazy(() => import('./admin/Admin').then((m) => ({ default: m.Admin })));


export function App() {
  const [ruta, setRuta] = useState<Ruta>(rutaActual);
  useEffect(() => {
    const cambio = () => setRuta(rutaActual());
    const propio = (e: Event) => setRuta((e as CustomEvent<Ruta>).detail);
    window.addEventListener('hashchange', cambio);
    window.addEventListener('atelier:ruta', propio);
    return () => {
      window.removeEventListener('hashchange', cambio);
      window.removeEventListener('atelier:ruta', propio);
    };
  }, []);
  if (ruta === 'admin') {
    return (
      <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-tinta-500">Cargando panel…</div>}>
        <Admin />
      </Suspense>
    );
  }
  return <Tienda />;
}
