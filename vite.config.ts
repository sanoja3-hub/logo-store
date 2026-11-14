import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `bun run demo` arma un solo archivo HTML con todo adentro (para compartir una demo sin servidor).
const esDemo = process.env.DEMO === '1';
// Catálogo que lleva la demo: el que indique DEMO_CATALOGO o el publicado en public/catalogo.json.
const catalogoDemo = path.resolve(process.env.DEMO_CATALOGO ?? 'public/catalogo.json');

const MIME: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', avif: 'image/avif', gif: 'image/gif' };

/**
 * Para la demo de un solo archivo, mete dentro del HTML el catálogo y sus fotos sueltas (`fotos/…`), que se
 * buscan junto al catalogo.json.
 */
function catalogoIncrustado(): Plugin {
  const id = '\0catalogo-demo';
  return {
    name: 'catalogo-demo',
    resolveId: (s) => (s === 'catalogo-demo.json' ? id : null),
    load(s) {
      if (s !== id) return null;
      if (!fs.existsSync(catalogoDemo)) {
        throw new Error(`La demo necesita un catálogo: no existe ${catalogoDemo}. Usa DEMO_CATALOGO=ruta/catalogo.json.`);
      }
      const carpeta = path.dirname(catalogoDemo);
      const incrustar = (f: unknown) => {
        if (typeof f !== 'string' || !f || f.startsWith('data:')) return f;
        const ruta = path.join(carpeta, f);
        if (!fs.existsSync(ruta)) {
          this.warn(`Falta la foto ${f}: la demo sale sin ella.`);
          return null;
        }
        const ext = path.extname(ruta).slice(1).toLowerCase();
        return `data:${MIME[ext] ?? 'image/webp'};base64,${fs.readFileSync(ruta).toString('base64')}`;
      };
      const cat = JSON.parse(fs.readFileSync(catalogoDemo, 'utf8'));
      for (const p of cat.productos ?? []) {
        p.foto = incrustar(p.foto);
        p.fotoEspalda = incrustar(p.fotoEspalda);
        p.fotos = (p.fotos ?? []).map(incrustar).filter(Boolean);
        for (const c of p.colores ?? []) c.foto = incrustar(c.foto);
      }
      return `export default ${JSON.stringify(cat)};`;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), catalogoIncrustado(), ...(esDemo ? [viteSingleFile()] : [])],
  define: { __DEMO__: JSON.stringify(esDemo) },
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
});
