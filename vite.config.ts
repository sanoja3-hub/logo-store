import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `bun run demo` arma un solo archivo HTML con todo adentro (para compartir una demo sin servidor).
const esDemo = process.env.DEMO === '1';

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(esDemo ? [viteSingleFile()] : [])],
  define: { __DEMO__: JSON.stringify(esDemo) },
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
});
