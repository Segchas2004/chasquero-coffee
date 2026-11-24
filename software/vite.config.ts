import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
const runtime = existsSync('.local-runtime.json') ? JSON.parse(readFileSync('.local-runtime.json', 'utf8')) : {};
export default defineConfig({ plugins: [react()], server: { host: runtime.chasquero?.lan ? '0.0.0.0' : '127.0.0.1', port: runtime.chasquero?.webPort || 5173, strictPort: true, proxy: { '/api': `http://127.0.0.1:${Number(process.env.CHASQUERO_API_PORT || runtime.chasquero?.apiPort || 3001)}` } }, build: { rollupOptions: { output: { manualChunks: (id: string) => id.includes('/recharts/') ? 'charts' : undefined } } } });
