import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, emptyState } from '../server/domain.mjs';
import { outstandingCents, pendingOperations } from '../src/workflow.mjs';
import { statisticsReport } from '../server/statistics.mjs';

const actor = { id: 'treasury-admin', role: 'administrador', area: 'general', active: true, name: 'Prueba' };
function scenario() {
  let state = emptyState(), n = 0;
  const run = (type, payload, requestId = `treasury-command-${++n}`) => {
    state = applyCommand(state, { type, payload, requestId }, actor);
    return state;
  };
  run('contact.save', { name: 'Contraparte de prueba', type: 'ambos' });
  const contactId = state.contacts[0].id;
  run('purchase.create', { contactId, stage: 'coco', quantity: '10', price: '10', paid: '20', lotCode: 'TES-001', date: '2026-11-23', priceReason: 'Precio para prueba aislada' });
  return { run, state: () => state, contactId };
}
const options = { from: '2026-11-01', to: '2026-11-30', financial: true };

test('Tesorería excluye una venta devuelta con cobro parcial y conserva su historial', () => {
  const s = scenario();
  s.run('sale.create', { contactId: s.contactId, lotId: s.state().lots[0].id, quantity: '5', price: '20', paid: '10', date: '2026-11-23', priceReason: 'Precio de prueba aislada' });
  const sale = s.state().sales[0];
  assert.equal(outstandingCents(sale), 9000);
  s.run('operation.return', { sourceType: 'sale', sourceId: sale.id, date: '2026-11-23', reason: 'Devolución completa confirmada', refundConfirmed: 'yes' });
  assert.equal(pendingOperations(s.state().sales).length, 0);
  assert.equal(outstandingCents(s.state().sales[0]), 0);
  assert.equal(s.state().sales[0].paidCents, 1000);
  assert.equal(s.state().cash.filter(x => x.sourceId === sale.id).reduce((t,x) => t+x.signedCents, 0), 0);
  assert.ok(!statisticsReport('balances', s.state(), options).rows.some(r => r[0] === 'Por cobrar'));
});

test('Tesorería excluye una compra devuelta y el reporte coincide con el listado', () => {
  const s = scenario(), purchase = s.state().purchases[0];
  assert.equal(outstandingCents(purchase), 8000);
  s.run('operation.return', { sourceType: 'purchase', sourceId: purchase.id, date: '2026-11-23', reason: 'Devolución completa al proveedor', refundConfirmed: 'yes' });
  assert.deepEqual(pendingOperations(s.state().purchases), []);
  assert.deepEqual(statisticsReport('balances', s.state(), options).rows, []);
  assert.equal(statisticsReport('statistics', s.state(), options).rows.find(r => r[0] === 'Por pagar')[1], 0);
});

test('Tesorería excluye operaciones anuladas o liquidadas y conserva crédito pendiente de entrega', () => {
  const operations = [
    { id: 'returned', status: 'devuelto', totalCents: 10000, paidCents: 1000 },
    { id: 'void', status: 'anulado', totalCents: 10000, paidCents: 0 },
    { id: 'paid', status: 'registrado', totalCents: 10000, paidCents: 10000 },
    { id: 'pending', status: 'registrado', deliveryStatus: 'pendiente', totalCents: 10000, paidCents: 1000 },
  ];
  assert.deepEqual(pendingOperations(operations).map(x => x.id), ['pending']);
  assert.equal(outstandingCents(operations[3]), 9000);
});

test('Caja rechaza cero y negativos sin modificar saldo ni auditoría', () => {
  const s = scenario(), before = structuredClone(s.state());
  for (const amount of ['0', '-0.01', '-5']) {
    assert.throws(() => s.run('cash.create', { direction: 'egreso', date: '2026-11-23', amount, concept: 'Prueba de validación' }));
    assert.deepEqual(s.state(), before);
  }
});

test('Anular exige motivo y un reintento conserva una sola compensación', () => {
  const s = scenario(), purchase = s.state().purchases[0], id = 'treasury-void-once';
  const payload = { sourceType: 'purchase', sourceId: purchase.id, date: '2026-11-23', reason: '' };
  assert.throws(() => s.run('operation.void', payload, id), /Motivo/);
  const first = s.run('operation.void', { ...payload, reason: 'Corrección de la compra' }, id);
  assert.deepEqual(s.run('operation.void', { ...payload, reason: 'Corrección de la compra' }, id), first);
  assert.equal(first.cash.filter(x => x.sourceType === 'reversal').length, 1);
  assert.deepEqual(pendingOperations(first.purchases), []);
});
