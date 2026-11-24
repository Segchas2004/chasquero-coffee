import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS, emptyState } from './domain.mjs';

import { localConfig } from './local-config.mjs';

export const production = process.env.CHASQUERO_ENV === 'production' || !!process.env.K_SERVICE;
export const projectId = production ? process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT : 'demo-chasquero-coffee';
if (production) {
  if (!projectId) throw new Error('Falta el ID del proyecto Firebase.');
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('No se permiten emuladores en producción.');
} else {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:' + localConfig.firestorePort;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:' + localConfig.authPort;
}
const app = initializeApp(production ? { projectId, credential: applicationDefault() } : { projectId });
export const auth = getAuth(app);
export const db = getFirestore(app);

async function readTransaction(tx) {
  const state = emptyState();
  const snapshots = await Promise.all(COLLECTIONS.map(name => tx.get(db.collection(name))));
  snapshots.forEach((snap, i) => { state[COLLECTIONS[i]] = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })); });
  const settings = await tx.get(db.doc('settings/company'));
  if (settings.exists) state.settings = { ...settings.data(), id: 'company' };
  return state;
}
export function readState() { return db.runTransaction(tx => readTransaction(tx), { readOnly: true }); }
export function transact(reduce) {
  return db.runTransaction(async tx => {
    const previous = await readTransaction(tx);
    const next = reduce(structuredClone(previous));
    for (const collection of COLLECTIONS) {
      const before = new Map(previous[collection].map(item => [item.id, item]));
      for (const item of next[collection]) {
        if (JSON.stringify(before.get(item.id)) !== JSON.stringify(item)) tx.set(db.doc(`${collection}/${item.id}`), item);
      }
    }
    if (JSON.stringify(previous.settings) !== JSON.stringify(next.settings)) tx.set(db.doc('settings/company'), next.settings);
    return next;
  });
}
