import { onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
process.env.CHASQUERO_ENV = 'production';
const { app } = await import('./index.mjs');
const webApiKey = defineString('FIREBASE_WEB_API_KEY', { description: 'API key de la app web Firebase (Configuración del proyecto)' });
export const api = onRequest({ region: 'us-central1', minInstances: 0, maxInstances: 1, concurrency: 10, timeoutSeconds: 60, memory: '256MiB' }, (req, res) => {
  process.env.FIREBASE_WEB_API_KEY = webApiKey.value();
  return app(req, res);
});
