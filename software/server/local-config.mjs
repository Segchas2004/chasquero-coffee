import { readFileSync, existsSync } from 'node:fs';
const defaults = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
const runtimePath = new URL('../.local-runtime.json', import.meta.url);
const config = existsSync(runtimePath) ? JSON.parse(readFileSync(runtimePath, 'utf8')) : defaults;
export const localConfig = {
  firestorePort: config.emulators.firestore.port,
  authPort: config.emulators.auth.port,
  apiPort: Number(process.env.CHASQUERO_API_PORT || config.chasquero?.apiPort || 3001),
  webPort: Number(process.env.CHASQUERO_WEB_PORT || config.chasquero?.webPort || 5173),
};
