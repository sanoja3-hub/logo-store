import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'exito';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-tinta-900 text-white hover:bg-tinta-800 shadow-sm',
  secundario: 'bg-white text-tinta-900 border border-tinta-200 hover:bg-tinta-50 hover:border-tinta-300',
  fantasma: 'text-tinta-600 hover:text-tinta-900 hover:bg-tinta-100',
  peligro: 'text-red-700 hover:bg-red-50',
  exito: 'bg-[#1f8a4c] text-white hover:bg-[#19773f] shadow-sm',
};

export function Boton({
  variante = 'primario',
  tamano = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamano?: 'sm' | 'md' | 'lg' }) {
  const t = tamano === 'sm' ? 'h-8 px-3 text-xs' : tamano === 'lg' ? 'h-12 px-6 text-sm' : 'h-10 px-4 text-sm';
  return (
    <button
      type="button"
      {...props}
      className={`foco inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${t} ${VARIANTES[variante]} ${className}`}
    />
  );
}

export function Campo({
  etiqueta,
  ayuda,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-tinta-600">{etiqueta}</span>
      <input
        {...props}
        className="foco h-10 w-full rounded-lg border border-tinta-200 bg-white px-3 text-sm text-tinta-900 placeholder:text-tinta-300 focus:border-tinta-400"
      />
      {ayuda && <span className="mt-1 block text-[11px] text-tinta-400">{ayuda}</span>}
    </label>
  );
}

export function AreaTexto({
  etiqueta,
  valor,
  onCambio,
  placeholder,
  filas = 3,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  placeholder?: string;
  filas?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-tinta-600">{etiqueta}</span>
      <textarea
        rows={filas}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onCambio(e.target.value)}
        className="foco w-full resize-y rounded-lg border border-tinta-200 bg-white px-3 py-2 text-sm placeholder:text-tinta-300 focus:border-tinta-400"
      />
    </label>
  );
}

export function Etiqueta({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'aviso' | 'ok' | 'acento' }) {
  const c =
    tono === 'aviso'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : tono === 'ok'
        ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
        : tono === 'acento'
          ? 'bg-acento-50 text-acento-600 ring-acento-100'
          : 'bg-tinta-100 text-tinta-600 ring-tinta-200';
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${c}`}>{children}</span>;
}

export function PanelLateral({
  abierto,
  onCerrar,
  titulo,
  children,
  pie,
  ancho = 'max-w-xl',
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = previo;
    };
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-tinta-950/40 backdrop-blur-[2px]" onClick={onCerrar} />
      <div className={`panel-entra relative flex h-full w-full ${ancho} flex-col bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-tinta-100 px-5 py-4">
          <div className="text-base font-semibold text-tinta-900">{titulo}</div>
          <button onClick={onCerrar} className="foco rounded-lg p-2 text-tinta-500 hover:bg-tinta-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {pie && <div className="border-t border-tinta-100 bg-tinta-50/60 px-5 py-4">{pie}</div>}
      </div>
    </div>
  );
}

export function Aviso({ tono = 'info', children }: { tono?: 'info' | 'error' | 'ok' | 'aviso'; children: ReactNode }) {
  const c =
    tono === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : tono === 'ok'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : tono === 'aviso'
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-tinta-200 bg-tinta-50 text-tinta-700';
  return <div className={`rounded-lg border px-3 py-2 text-sm ${c}`}>{children}</div>;
}

/** Miniatura de la foto del producto, o un recuadro neutro si no hay foto. */
export function Foto({ src, alt, className = '' }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`grid place-items-center bg-tinta-100 text-[11px] text-tinta-400 ${className}`}>Sin foto</div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={`object-contain ${className}`} />;
}
