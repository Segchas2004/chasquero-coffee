import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, emptyState, decimal, visibleState, csv } from '../server/domain.mjs';

const director = { id: 'director', name: 'Director de prueba', role: 'administrador', area: 'general', email: 'admin@prueba.local', active: true };
const warehouse = { id: 'almacen', name: 'Almacén de prueba', role: 'trabajador', area: 'almacen', active: true };
let seq = 0;
function execute(state, type, payload, actor = director, requestId = `unit-${++seq}-command`) {
  return applyCommand(state, { type, payload: { ...payload, priceReason: 'Precio especial autorizado para el caso de prueba' }, requestId }, actor, '2026-09-14T12:00:00.000Z');
}
function fixture() {
  let state = emptyState(); state.users = [director, warehouse];
  state = execute(state, 'price.save', { stage: 'coco', kind: 'compra', amount: '10', reason: 'Tarifa de prueba' }, director, 'price-coco-test');
  state = execute(state, 'contact.save', { name: 'Productor de prueba', type: 'proveedor' }, director, 'producer-fixture');
  state = execute(state, 'contact.save', { name: 'Cliente de prueba', type: 'cliente' }, director, 'customer-fixture');
  state = execute(state, 'purchase.create', { contactId: 'producer-fixture', date: '2026-09-09', quantity: '100', price: '10', paid: '200', stage: 'coco', lotCode: 'TEST-001' }, director, 'purchase-fixture');
  return state;
}
const purchase = overrides => ({ contactId: 'producer-fixture', date: '2026-09-10', quantity: '10', price: '10', paid: '0', stage: 'coco', lotCode: 'TEST-002', priceId: 'price-coco-test', priceVersion: 1, priceReason: 'Precio especial para la prueba', ...overrides });
const sale = overrides => ({ contactId: 'customer-fixture', lotId: 'purchase-fixture-lot', date: '2026-09-10', quantity: '5', price: '20', paid: '0', ...overrides });

test('CP-01 Decimal exacto conserva gramos y céntimos sin aceptar datos inválidos', () => {
  assert.equal(decimal('12.345', 3, 'Peso'), 12345); assert.equal(decimal('10.01', 2, 'Monto'), 1001);
  for (const v of ['-1', 'NaN', 'Infinity', '1e4', '1.2345', '0']) assert.throws(() => decimal(v, 3, 'Peso'));
});
test('CP-02 Compra crea lote, saldo por pagar y un único egreso por el pago inicial', () => {
  const s = fixture(); assert.equal(s.lots[0].stockGrams, 100000); assert.equal(s.purchases[0].totalCents, 100000); assert.equal(s.purchases[0].paidCents, 20000); assert.equal(s.cash[0].signedCents, -20000);
});
test('CP-03 Reintentar la misma compra no duplica caja, lote ni bitácora', () => {
  const s = fixture(); const c = { type: 'purchase.create', payload: purchase({}), requestId: 'same-request-001' };
  const first = applyCommand(s, c, director); const second = applyCommand(first, c, director);
  assert.deepEqual(second, first); assert.throws(() => applyCommand(first, { ...c, payload: purchase({ price: '11' }) }, director), /otra operación/);
});
test('CP-04 Stock insuficiente bloquea la venta sin modificar el estado original', () => {
  const s = fixture(); const copy = structuredClone(s);
  assert.throws(() => execute(s, 'sale.create', sale({ quantity: '100.001' })), /existencias/); assert.deepEqual(s, copy);
});
test('CP-05 Venta parcial descuenta peso y costo y solo el cobro afecta caja', () => {
  const s = execute(fixture(), 'sale.create', sale({ quantity: '25', price: '20', paid: '100' }), director, 'sale-fixture');
  assert.equal(s.lots[0].stockGrams, 75000); assert.equal(s.lots[0].valueCents, 75000); assert.equal(s.sales[0].costCents, 25000); assert.equal(s.sales[0].totalCents, 50000); assert.equal(s.cash.at(-1).signedCents, 10000);
});
test('CP-06 Abono liquida saldo sin registrar nuevamente el total de la venta', () => {
  let s = execute(fixture(), 'sale.create', sale({ paid: '25' }), director, 'sale-fixture');
  s = execute(s, 'payment.create', { sourceType: 'sale', sourceId: 'sale-fixture', date: '2026-09-11', amount: '75', method: 'yape' });
  assert.equal(s.sales[0].paidCents, 10000); assert.equal(s.cash.filter(x => x.sourceId === 'sale-fixture').reduce((n, x) => n + x.signedCents, 0), 10000);
  assert.throws(() => execute(s, 'payment.create', { sourceType: 'sale', sourceId: 'sale-fixture', date: '2026-09-11', amount: '0.01' }), /saldo/);
});
test('CP-07 Trillado mantiene la trazabilidad y transfiere el costo con merma medida', () => {
  const s = execute(fixture(), 'process.create', { lotId: 'purchase-fixture-lot', date: '2026-09-10', inputQuantity: '50', outputQuantity: '40', stage: 'verde', lotCode: 'VER-TEST' });
  assert.equal(s.lots[0].stockGrams, 50000); assert.equal(s.lots[1].stockGrams, 40000); assert.equal(s.lots[1].parentId, s.lots[0].id); assert.equal(s.processes[0].wasteGrams, 10000); assert.equal(s.lots.reduce((n, x) => n + x.valueCents, 0), 100000);
});
test('CP-08 Rechaza salida mayor que entrada y transición de proceso incorrecta', () => {
  const p = { lotId: 'purchase-fixture-lot', date: '2026-09-10', inputQuantity: '50', outputQuantity: '51', stage: 'verde', lotCode: 'VER-TEST' };
  assert.throws(() => execute(fixture(), 'process.create', p), /salida/);
  assert.throws(() => execute(fixture(), 'process.create', { ...p, outputQuantity: '40', stage: 'molido' }), /etapa/);
});
test('CP-09 Almacén no puede cobrar, pagar ni crear usuarios aunque invoque la operación directamente', () => {
  const s = fixture();
  assert.throws(() => execute(s, 'purchase.create', purchase({ paid: '1' }), warehouse), /pagos/);
  for (const type of ['sale.create', 'cash.create', 'payment.create', 'user.save', 'settings.update']) assert.throws(() => execute(s, type, {}, warehouse), /permiso/);
  const visible = visibleState(s, warehouse); assert.deepEqual(visible.cash, []); assert.deepEqual(visible.users, []); assert.deepEqual(visible.audit, []);
});
test('CP-10 Anular una venta repone peso y costo, compensa los cobros y conserva el historial', () => {
  let s = execute(fixture(), 'sale.create', sale({ paid: '100' }), director, 'sale-fixture');
  s = execute(s, 'operation.void', { sourceType: 'sale', sourceId: 'sale-fixture', date: '2026-09-11', reason: 'Corrección de prueba' });
  assert.equal(s.lots[0].stockGrams, 100000); assert.equal(s.lots[0].valueCents, 100000); assert.equal(s.sales[0].status, 'anulado'); assert.equal(s.cash.reduce((n, x) => n + x.signedCents, 0), -20000);
  assert.throws(() => execute(s, 'operation.void', { sourceType: 'sale', sourceId: 'sale-fixture', date: '2026-09-11', reason: 'Repetición' }), /ya fue/);
});
test('CP-11 No anula compras con salidas posteriores sin revertir', () => {
  const s = execute(fixture(), 'sale.create', sale({}));
  assert.throws(() => execute(s, 'operation.void', { sourceType: 'purchase', sourceId: 'purchase-fixture', date: '2026-09-11', reason: 'Error de registro' }), /salidas/);
});
test('CP-12 Reversión manual compensa caja y no permite una segunda reversión', () => {
  let s = execute(fixture(), 'cash.create', { date: '2026-09-10', direction: 'ingreso', amount: '100', concept: 'Aporte de prueba' }, director, 'manual-fixture');
  s = execute(s, 'cash.void', { id: 'manual-fixture-cash', date: '2026-09-11', reason: 'Corrección' });
  assert.equal(s.cash.reduce((n, x) => n + x.signedCents, 0), -20000);
  assert.throws(() => execute(s, 'cash.void', { id: 'manual-fixture-cash', date: '2026-09-11', reason: 'Repetido' }), /vigentes/);
});
test('CP-13 Valida fecha real, humedad, lote único y pago excesivo', () => {
  for (const p of [purchase({ date: '2026-02-30' }), purchase({ moisture: '101' }), purchase({ lotCode: 'TEST-001' }), purchase({ paid: '100.01' })]) assert.throws(() => execute(fixture(), 'purchase.create', p));
});
test('CP-14 Contacto inactivo no participa en nuevas operaciones', () => {
  const s = execute(fixture(), 'contact.save', { id: 'producer-fixture', name: 'Productor de prueba', type: 'proveedor', active: false });
  assert.throws(() => execute(s, 'purchase.create', purchase({})), /activo/);
});
test('CP-15 Administrador no puede desactivar ni degradar su propio acceso', () => {
  assert.throws(() => execute(fixture(), 'user.save', { ...director, email: 'local@prueba.local', active: false }), /propio rol|propio acceso/);
  assert.throws(() => execute(fixture(), 'user.save', { ...director, email: 'local@prueba.local', role: 'trabajador', area: 'caja' }), /propio rol|propio acceso/);
});
test('CP-16 CSV conserva acentos, separadores y neutraliza fórmulas de celdas', () => {
  const result = csv(['Nombre', 'Valor'], [['Café "Las Pirias"', '=1+1']]);
  assert.ok(result.startsWith('\ufeff')); assert.ok(result.includes('Café ""Las Pirias""')); assert.ok(result.includes("'=1+1"));
});
