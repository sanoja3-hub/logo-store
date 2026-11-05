import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Escena3D, type EstadoVisor, type Vista } from './escena';

export interface Visor3DRef {
  capturar: (vista?: Vista) => string | null;
  verVista: (v: Vista) => void;
}

function soportaWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export const Visor3D = forwardRef<Visor3DRef, EstadoVisor & { className?: string }>(function Visor3D(props, ref) {
  const contenedor = useRef<HTMLDivElement>(null);
  const escena = useRef<Escena3D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { forma, colorHex, logo, ubicacion, escalaLogo } = props;

  useEffect(() => {
    if (!contenedor.current) return;
    if (!soportaWebGL()) {
      setError('Este dispositivo no permite gráficos 3D. Puedes ver la foto del artículo.');
      return;
    }
    try {
      escena.current = new Escena3D(contenedor.current);
    } catch {
      setError('No se pudo iniciar la vista 3D en este navegador.');
    }
    return () => {
      escena.current?.destruir();
      escena.current = null;
    };
  }, []);

  useEffect(() => {
    escena.current?.actualizar({ forma, colorHex, logo, ubicacion, escalaLogo });
  }, [forma, colorHex, logo, ubicacion, escalaLogo]);

  useImperativeHandle(ref, () => ({
    capturar: (vista) => escena.current?.capturar(vista) ?? null,
    verVista: (v) => escena.current?.verVista(v),
  }));

  return (
    <div ref={contenedor} className={`relative ${props.className ?? ''}`}>
      {error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-tinta-500">{error}</div>}
    </div>
  );
});
