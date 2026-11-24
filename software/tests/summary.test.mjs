import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../src/summary.mjs';
import { statisticsReport } from '../server/statistics.mjs';
import { emptyState } from '../server/domain.mjs';
const range={from:'2026-11-24',to:'2026-11-24'};
test('Panel y estadísticas contabilizan la venta en su fecha de entrega',()=>{
 const s=emptyState();s.sales=[{id:'sale',date:'2026-11-23',fulfilledDate:'2026-11-24',status:'registrado',deliveryStatus:'vendido',totalCents:10000,paidCents:2000,costCents:5000,grams:1000}];
 assert.equal(summarize(s,range).sales,10000);
 assert.equal(summarize(s,{from:'2026-11-23',to:'2026-11-23'}).sales,0);
 assert.equal(statisticsReport('statistics',s,{...range,financial:true}).rows.find(x=>x[0]==='Ventas entregadas')[1],100);
});
test('Un periodo sin movimientos conserva inventario y deudas actuales',()=>{
 const s=emptyState();s.lots=[{status:'activo',stockGrams:10000,reservedGrams:2000}];s.sales=[{status:'registrado',date:'2026-11-01',deliveryStatus:'vendido',totalCents:10000,paidCents:2000}];
 const r=summarize(s,range);assert.equal(r.income,0);assert.equal(r.expense,0);assert.equal(r.sales,0);assert.equal(r.toCollect,8000);assert.equal(r.stock,10000);
});
test('Panel separa saldo inicial y flujos del periodo e incluye compensaciones',()=>{
 const s=emptyState();s.cash=[{date:'2026-11-23',signedCents:10000},{date:'2026-11-24',signedCents:2000},{date:'2026-11-24',signedCents:-500},{date:'2026-11-25',signedCents:9999}];
 assert.deepEqual(summarize(s,range),{income:2000,expense:500,balance:11500,opening:10000,sales:0,toCollect:0,toPay:0,stock:0});
});
test('Panel excluye ventas pendientes, devueltas y anuladas de las ventas entregadas',()=>{
 const s=emptyState();s.sales=[{status:'registrado',deliveryStatus:'pendiente'},{status:'devuelto',deliveryStatus:'vendido'},{status:'anulado',deliveryStatus:'vendido'}].map(x=>({...x,date:'2026-11-24',totalCents:10000,paidCents:1000}));
 const r=summarize(s,range);assert.equal(r.sales,0);assert.equal(r.toCollect,9000);
});
test('Un sistema sin operaciones muestra ceros y no incluye lotes pendientes',()=>{
 const s=emptyState();s.lots=[{status:'pendiente',stockGrams:0}];assert.deepEqual(summarize(s,range),{income:0,expense:0,balance:0,opening:0,sales:0,toCollect:0,toPay:0,stock:0});
});
