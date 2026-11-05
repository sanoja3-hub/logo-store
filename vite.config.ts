import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `bun run demo` arma un solo archivo HTML con todo adentro (para compartir una demo sin servidor).
const esDemo = process.env.DEMO === '1';
// Catálogo que lleva la demo: el de ejemplo, o el que indique DEMO_CATALOGO (ruta a un catalogo.json).
const catalogoDemo = path.resolve(process.env.DEMO_CATALOGO ?? 'src/demo/catalogo-demo.json');

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(esDemo ? [viteSingleFile()] : [])],
  define: { __DEMO__: JSON.stringify(esDemo), __DEMO_EJEMPLO__: JSON.stringify(!process.env.DEMO_CATALOGO) },
  resolve: { alias: { 'catalogo-demo.json': catalogoDemo } },
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
});
