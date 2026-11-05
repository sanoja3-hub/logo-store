import { lazy, Suspense, useEffect, useState } from 'react';
import { Tienda } from './tienda/Tienda';

const Admin = lazy(() => import('./admin/Admin').then((m) => ({ default: m.Admin })));

function rutaActual() {
  return window.location.hash.startsWith('#/admin') ? 'admin' : 'tienda';
}

export function App() {
  const [ruta, setRuta] = useState(rutaActual);
  useEffect(() => {
    const cambio = () => setRuta(rutaActual());
    window.addEventListener('hashchange', cambio);
    return () => window.removeEventListener('hashchange', cambio);
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
