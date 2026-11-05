import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface Foto3DRef {
  verLado: (lado: 'frente' | 'espalda') => void;
}

/**
 * La foto real del catálogo montada como una pieza que gira en 3D: frente y espalda en las dos caras.
 * Si el catálogo no trae la espalda, la foto se inclina con el arrastre y vuelve al frente.
 */
export const Foto3D = forwardRef<
  Foto3DRef,
  { frente: string; espalda?: string | null; alt: string; className?: string; onLado?: (lado: 'frente' | 'espalda') => void }
>(function Foto3D({ frente, espalda, alt, className = '', onLado }, ref) {
  const pieza = useRef<HTMLDivElement>(null);
  const brillo = useRef<HTMLDivElement>(null);
  const sombra = useRef<HTMLDivElement>(null);
  const estado = useRef({ angulo: 0, velocidad: 0, destino: 0 as number | null, arrastrando: false, x: 0, t: 0, inclinacion: 0 });
  const [lado, setLado] = useState<'frente' | 'espalda'>('frente');
  const dosCaras = !!espalda;
  const reducido = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const pintar = useCallback(() => {
    const e = estado.current;
    if (!pieza.current) return;
    pieza.current.style.transform = `rotateX(${e.inclinacion.toFixed(2)}deg) rotateY(${e.angulo.toFixed(2)}deg)`;
    const rad = (e.angulo * Math.PI) / 180;
    if (brillo.current) {
      // Un reflejo que se desplaza con el giro: da volumen a la foto plana.
      const s = Math.sin(rad);
      brillo.current.style.opacity = String(Math.min(0.55, Math.abs(s) * 0.7));
      brillo.current.style.background = `linear-gradient(${s > 0 ? 100 : 260}deg, rgba(255,255,255,0) 30%, rgba(255,255,255,.55) 50%, rgba(255,255,255,0) 70%)`;
    }
    if (sombra.current) {
      const c = Math.abs(Math.cos(rad));
      sombra.current.style.transform = `scaleX(${(0.35 + 0.65 * c).toFixed(3)})`;
    }
    const nuevo = dosCaras && Math.cos(rad) < 0 ? 'espalda' : 'frente';
    setLado((l) => (l === nuevo ? l : nuevo));
  }, [dosCaras]);

  useEffect(() => onLado?.(lado), [lado, onLado]);

  // Bucle de animación: inercia, imán al frente/espalda y vaivén de bienvenida.
  useEffect(() => {
    let raf = 0;
    let previo = performance.now();
    const inicio = previo;
    const e = estado.current;
    e.angulo = 0;
    e.destino = 0;
    const paso = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - previo) / 1000);
      previo = ahora;
      const bienvenida = !reducido.current && ahora - inicio < 2600 && !e.arrastrando && e.destino === 0;
      if (bienvenida) {
        // Vaivén suave para que se note que la foto gira.
        const t = (ahora - inicio) / 2600;
        e.angulo = Math.sin(t * Math.PI * 2) * 28 * (1 - t);
      } else if (!e.arrastrando) {
        if (Math.abs(e.velocidad) > 8) {
          e.angulo += e.velocidad * dt;
          e.velocidad *= Math.pow(0.04, dt);
          if (!dosCaras) e.angulo = Math.max(-40, Math.min(40, e.angulo));
        } else {
          e.velocidad = 0;
          const destino = e.destino ?? (dosCaras ? Math.round(e.angulo / 180) * 180 : 0);
          e.angulo += (destino - e.angulo) * Math.min(1, dt * 7);
          if (Math.abs(destino - e.angulo) < 0.05) e.angulo = destino;
        }
      }
      e.inclinacion += ((e.arrastrando ? -2 : 0) - e.inclinacion) * Math.min(1, dt * 6);
      pintar();
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [frente, espalda, dosCaras, pintar]);

  useImperativeHandle(ref, () => ({
    verLado: (l) => {
      const e = estado.current;
      if (l === 'espalda' && !dosCaras) return;
      const base = Math.round(e.angulo / 360) * 360;
      e.velocidad = 0;
      e.destino = l === 'frente' ? base : base + (e.angulo - base >= 0 ? 180 : -180);
    },
  }));

  const abajo = (ev: React.PointerEvent) => {
    const e = estado.current;
    e.arrastrando = true;
    e.destino = null;
    e.velocidad = 0;
    e.x = ev.clientX;
    e.t = performance.now();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  };
  const mover = (ev: React.PointerEvent) => {
    const e = estado.current;
    if (!e.arrastrando) return;
    const dx = ev.clientX - e.x;
    const ahora = performance.now();
    const factor = dosCaras ? 0.6 : 0.35;
    e.angulo += dx * factor;
    if (!dosCaras) e.angulo = Math.max(-40, Math.min(40, e.angulo));
    e.velocidad = (dx * factor) / Math.max(0.008, (ahora - e.t) / 1000);
    e.x = ev.clientX;
    e.t = ahora;
  };
  const arriba = () => {
    const e = estado.current;
    e.arrastrando = false;
    if (!dosCaras) e.velocidad = 0;
    e.velocidad = Math.max(-900, Math.min(900, e.velocidad));
  };

  const cara = 'absolute inset-0 flex items-center justify-center [backface-visibility:hidden] [-webkit-backface-visibility:hidden]';
  return (
    <div
      className={`relative select-none touch-pan-y [perspective:1600px] ${className}`}
      onPointerDown={abajo}
      onPointerMove={mover}
      onPointerUp={arriba}
      onPointerCancel={arriba}
      data-lado={lado}
    >
      <div ref={pieza} className="absolute inset-[4%] bottom-[9%] [transform-style:preserve-3d] will-change-transform">
        <div className={cara}>
          <img src={frente} alt={`${alt} · frente`} draggable={false} className="max-h-full max-w-full rounded-lg object-contain shadow-[0_18px_40px_-18px_rgba(15,23,42,.45)]" />
        </div>
        {dosCaras && (
          <div className={`${cara} [transform:rotateY(180deg)]`}>
            <img src={espalda!} alt={`${alt} · espalda`} draggable={false} className="max-h-full max-w-full rounded-lg object-contain shadow-[0_18px_40px_-18px_rgba(15,23,42,.45)]" />
          </div>
        )}
        <div ref={brillo} className="pointer-events-none absolute inset-0 rounded-lg mix-blend-soft-light" />
      </div>
      <div
        ref={sombra}
        className="pointer-events-none absolute inset-x-[22%] bottom-[5%] h-5 rounded-[50%] bg-tinta-950/25 blur-md"
      />
    </div>
  );
});
