import { pathToFileURL } from 'node:url';
import { auth, readState, transact, db } from '../server/firebase.mjs';
import { applyCommand, normalizeUser } from '../server/domain.mjs';

import { recordAudit } from '../server/audit.mjs';

export const demoAccounts = [
  { id: 'local-director', name: 'Norberto Chasquero Ocaña', email: 'director@chasquero.local', role: 'gerente', area: 'general' },
  { id: 'local-administrador', name: 'Segundo Norberto Chasquero Castillo', email: 'administracion@chasquero.local', role: 'administrador', area: 'general' },
  { id: 'local-almacen', name: 'Nilson Chasquero Ocaña', email: 'almacen@chasquero.local', role: 'trabajador', area: 'almacen' },
  { id: 'local-caja', name: 'Eusebia Castillo Facundo', email: 'caja@chasquero.local', role: 'trabajador', area: 'caja' },
];

const seedPrices = (state, stamp) => {
  const actor = state.users.find(x => x.role === 'administrador' && x.active);
  if (!actor || state.prices.length) return state;
  const amounts = { coco: [9.20, 12], pergamino: [812, 17.50], verde: [22, 29], tostado: [45, 65], molido: [48, 70] };
  for (const [stage, values] of Object.entries(amounts)) for (const [i, kind] of ['compra', 'venta'].entries()) {
    state = applyCommand(state, { type: 'price.save', requestId: `tarifa-demo-${kind}-${stage}`, payload: { stage, quality: stage === 'pergamino' ? 70 : null, kind, amount: values[i].toFixed(2), reason: 'Tarifa ficticia para practicar el flujo de precios' } }, actor, stamp);
  }
  return state;
};

export async function seed() {
  if (process.env.CHASQUERO_ENV === 'production' || process.env.K_SERVICE) throw new Error('La demostración solo puede cargarse en emuladores.');
  const initial = await readState();
  if (initial.users.length) {
    await transact(previous => {
      let state = structuredClone(previous);
      const now = new Date().toISOString();
      if (state.users.some(x => !x.area || ['director', 'almacen', 'caja'].includes(x.role))) {
        state.users = state.users.map(normalizeUser);
        recordAudit(previous, state, { id: 'migracion-perfiles-v2', type: 'system.migration', entityId: 'users', actorId: 'system', actorName: 'Actualización del sistema', actorRole: 'sistema', actorEmail: '', description: 'Adaptó los accesos existentes a gerente, administrador y trabajador', at: now });
      }
      return seedPrices(state, now);
    });
    console.log('Se conservaron cuentas, contraseñas, operaciones e historial. Perfiles actualizados.'); return;
  }
  for (const account of demoAccounts) {
    try { await auth.getUser(account.id); } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      await auth.createUser({ uid: account.id, email: account.email, password: 'CafeLocal2026!', displayName: account.name });
    }
  }
  await transact(state => {
    state.users = demoAccounts.map(x => ({ ...x, active: true }));
    state = seedPrices(state, '2026-09-14T12:00:00.000Z');
    const actor = state.users[1];
    const add = (id, type, payload) => { state = applyCommand(state, { requestId: id, type, payload: { ...payload, priceReason: 'Precio de práctica autorizado por administración' } }, actor, '2026-09-14T12:00:00.000Z'); };
    const contacts = [
      ['proveedor-01', 'Productor de ejemplo A', 'proveedor', 'Las Pirias'],
      ['proveedor-02', 'Productor de ejemplo B', 'proveedor', 'Alto Pirias'],
      ['proveedor-03', 'Productor de ejemplo C', 'proveedor', 'Chirinos'],
      ['cliente-01', 'Cafetería de ejemplo', 'cliente', 'San Ignacio'],
      ['cliente-02', 'Cliente local de ejemplo', 'cliente', 'Las Pirias'],
      ['cliente-03', 'Distribuidor de ejemplo', 'cliente', 'Jaén'],
    ];
    for (const [id, name, type, location] of contacts) add(id, 'contact.save', { name, type, location });
    add('aporte-inicial', 'cash.create', { date: '2026-09-09', direction: 'ingreso', amount: '20000', concept: 'Saldo inicial de práctica', method: 'efectivo' });
    add('compra-demo-001', 'purchase.create', { date: '2026-09-09', contactId: 'proveedor-01', quantity: '650', price: '812', moistureDivisor: '55.5', paid: '8000', stage: 'pergamino', quality: 70, lotCode: 'PER-260909-01', origin: 'Las Pirias', moisture: '12', method: 'efectivo' });
    add('compra-demo-002', 'purchase.create', { date: '2026-09-10', contactId: 'proveedor-02', quantity: '480', price: '9.20', paid: '2400', stage: 'coco', lotCode: 'COC-260910-01', origin: 'Alto Pirias', moisture: '13', method: 'transferencia' });
    add('proceso-demo-001', 'process.create', { date: '2026-09-10', lotId: 'compra-demo-001-lot', inputQuantity: '250', outputQuantity: '195', stage: 'verde', lotCode: 'VER-260910-01', note: 'Pesos de práctica. La merma es la diferencia medida.' });
    add('proceso-demo-002', 'process.create', { date: '2026-09-11', lotId: 'proceso-demo-001-lot', inputQuantity: '100', outputQuantity: '84', stage: 'tostado', lotCode: 'TOS-260911-01' });
    add('proceso-demo-003', 'process.create', { date: '2026-09-11', lotId: 'proceso-demo-002-lot', inputQuantity: '30', outputQuantity: '29.4', stage: 'molido', lotCode: 'MOL-260911-01' });
    add('venta-demo-001', 'sale.create', { date: '2026-09-11', contactId: 'cliente-01', lotId: 'proceso-demo-002-lot', quantity: '18', price: '65', paid: '800', method: 'transferencia' });
    add('venta-demo-002', 'sale.create', { date: '2026-09-12', contactId: 'cliente-02', lotId: 'proceso-demo-003-lot', quantity: '8.5', price: '70', paid: '595', method: 'yape' });
    add('venta-demo-003', 'sale.create', { date: '2026-09-12', contactId: 'cliente-03', lotId: 'compra-demo-001-lot', quantity: '120', price: '17.50', paid: '1500', method: 'transferencia' });
    add('gasto-demo-001', 'cash.create', { date: '2026-09-12', direction: 'egreso', amount: '185', concept: 'Transporte local de práctica', method: 'efectivo' });
    add('compra-demo-003', 'purchase.create', { date: '2026-09-13', contactId: 'proveedor-03', quantity: '320', price: '828.80', moistureDivisor: '55.5', paid: '3000', stage: 'pergamino', quality: 70, lotCode: 'PER-260913-01', origin: 'Chirinos', moisture: '12', method: 'transferencia' });
    add('venta-demo-004', 'sale.create', { date: '2026-09-13', contactId: 'cliente-01', lotId: 'proceso-demo-003-lot', quantity: '5', price: '70', paid: '350', method: 'efectivo' });
    add('abono-demo-001', 'payment.create', { date: '2026-09-14', sourceType: 'sale', sourceId: 'venta-demo-001', amount: '370', method: 'transferencia' });
    add('gasto-demo-002', 'cash.create', { date: '2026-09-14', direction: 'egreso', amount: '240', concept: 'Servicio de tostado de práctica', method: 'efectivo' });
    return state;
  });
  console.log('Datos de práctica y cuatro cuentas locales preparados. No se modificó ningún proyecto de Firebase en la nube.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seed(); await db.terminate();
}
