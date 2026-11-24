import test from 'node:test';import assert from 'node:assert/strict';
import {applyCommand,emptyState} from '../server/domain.mjs';
import {operationStatus,availableGrams} from '../src/workflow.mjs';
import {statisticsReport} from '../server/statistics.mjs';
const admin={id:'admin',name:'Admin',role:'administrador',area:'general',active:true};const warehouse={id:'warehouse',name:'Almacén',role:'trabajador',area:'almacen',active:true};const cashier={id:'cashier',name:'Caja',role:'trabajador',area:'caja',active:true};let n=0;
const run=(s,type,payload,actor=admin,requestId='workflow-test-'+ ++n)=>applyCommand(s,{type,payload,requestId},actor);
function fixture(){let s=emptyState();s.users=[admin,warehouse,cashier];s=run(s,'contact.save',{name:'Contraparte',type:'ambos'});return s;}
const purchase=(s,extra={})=>({contactId:s.contacts[0].id,stage:'coco',date:'2026-10-13',lotCode:'WF-'+ ++n,quantity:'10',price:'10',priceReason:'Precio para prueba de flujo',paid:'20',...extra});
const sale=(s,extra={})=>({contactId:s.contacts[0].id,lotId:s.lots[0].id,date:'2026-10-13',quantity:'6',price:'20',priceReason:'Precio para prueba de flujo',paid:'10',...extra});
test('Compra pendiente no ingresa stock; recibir una vez actualiza lote sin duplicar pago',()=>{
 let s=fixture();s=run(s,'purchase.create',purchase(s,{deliveryStatus:'pendiente'}));assert.equal(s.lots[0].stockGrams,0);assert.equal(s.lots[0].valueCents,0);assert.equal(operationStatus(s.purchases[0],'purchase'),'pendiente');
 const cash=structuredClone(s.cash),p={id:s.purchases[0].id,date:'2026-10-14'};
 s=run(s,'purchase.receive',p,warehouse,'receive-idempotent');assert.equal(s.lots[0].stockGrams,10000);assert.equal(s.lots[0].valueCents,10000);assert.deepEqual(s.cash,cash);
 assert.deepEqual(run(s,'purchase.receive',p,warehouse,'receive-idempotent'),s);assert.throws(()=>run(s,'purchase.receive',p,warehouse),/pendiente/);
});
test('Venta pendiente reserva café y evita sobreventa o procesamiento del stock comprometido',()=>{
 let s=fixture();s=run(s,'purchase.create',purchase(s));s=run(s,'sale.create',sale(s,{deliveryStatus:'pendiente'}));assert.equal(s.lots[0].stockGrams,10000);assert.equal(s.lots[0].reservedGrams,6000);assert.equal(availableGrams(s.lots[0]),4000);
 assert.throws(()=>run(s,'sale.create',sale(s,{quantity:'5'})),/cantidad/);
 assert.throws(()=>run(s,'process.create',{lotId:s.lots[0].id,date:'2026-10-13',inputQuantity:'5',outputQuantity:'4',stage:'verde',lotCode:'PROCESO-RESERVA'}),/cantidad/);
 const cash=structuredClone(s.cash);s=run(s,'sale.deliver',{id:s.sales[0].id,date:'2026-10-14'},cashier);assert.equal(s.lots[0].stockGrams,4000);assert.equal(s.lots[0].reservedGrams,0);assert.equal(s.sales[0].costCents,6000);assert.deepEqual(s.cash,cash);
});
test('Anular venta pendiente libera reserva sin aumentar stock físico',()=>{
 let s=fixture();s=run(s,'purchase.create',purchase(s));s=run(s,'sale.create',sale(s,{deliveryStatus:'pendiente'}));const id=s.sales[0].id;
 s=run(s,'operation.void',{sourceType:'sale',sourceId:id,date:'2026-10-13',reason:'Cancelación antes de entrega'});assert.equal(s.lots[0].stockGrams,10000);assert.equal(s.lots[0].reservedGrams,0);assert.equal(s.cash.filter(x=>x.sourceId===id).reduce((a,x)=>a+x.signedCents,0),0);
});
test('Devolver venta completa repone stock y dinero; anularla después no compensa otra vez',()=>{
 let s=fixture();s=run(s,'purchase.create',purchase(s));s=run(s,'sale.create',sale(s));const id=s.sales[0].id;
 const payload={sourceType:'sale',sourceId:id,date:'2026-10-13',reason:'Devolución completa del cliente',refundConfirmed:'yes'};
 assert.throws(()=>run(s,'operation.return',{...payload,refundConfirmed:''}),/reintegro/);
 s=run(s,'operation.return',payload);assert.equal(s.sales[0].status,'devuelto');assert.equal(s.lots[0].stockGrams,10000);assert.equal(s.cash.filter(x=>x.sourceId===id).reduce((a,x)=>a+x.signedCents,0),0);
 assert.throws(()=>run(s,'operation.return',payload),/devuelve/);const cash=structuredClone(s.cash),lots=structuredClone(s.lots);
 s=run(s,'operation.void',{...payload,reason:'Anulación administrativa tras devolución'});assert.equal(s.sales[0].status,'anulado');assert.deepEqual(s.cash,cash);assert.deepEqual(s.lots,lots);assert.equal(s.sales[0].returnReason,payload.reason);
});
test('Devolver compra exige lote íntegro y sin reservas; pago y abonos no se repiten',()=>{
 let s=fixture();s=run(s,'purchase.create',purchase(s));const op=s.purchases[0];const p={sourceType:'purchase',sourceId:op.id,date:'2026-10-13',reason:'Devolución al productor',refundConfirmed:'yes'};
 let reserved=run(s,'sale.create',sale(s,{deliveryStatus:'pendiente'}));assert.throws(()=>run(reserved,'operation.return',p),/salidas/);
 s=run(s,'operation.return',p);assert.equal(s.lots[0].stockGrams,0);assert.equal(s.lots[0].valueCents,0);assert.equal(s.lots[0].status,'devuelto');assert.throws(()=>run(s,'payment.create',{sourceType:'purchase',sourceId:op.id,amount:'1',date:'2026-10-13'}),/devuelta/);
});
test('Permisos y fecha: almacén no devuelve dinero y caja no recibe compras',()=>{
 let s=fixture();s=run(s,'purchase.create',purchase(s,{deliveryStatus:'pendiente'}));const op=s.purchases[0];assert.throws(()=>run(s,'purchase.receive',{id:op.id,date:'2026-10-13'},cashier),/permiso/);
 assert.throws(()=>run(s,'operation.return',{sourceType:'purchase',sourceId:op.id,date:'2026-10-13',reason:'Intento sin permisos'},warehouse),/permiso/);
 assert.throws(()=>run(s,'operation.return',{sourceType:'purchase',sourceId:op.id,date:'2026-10-13',reason:'Aún no se recibe'},admin),/pendiente/);
 s=run(s,'purchase.receive',{id:op.id,date:'2026-10-14'});assert.throws(()=>run(s,'operation.return',{sourceType:'purchase',sourceId:op.id,date:'2026-10-13',reason:'Fecha anterior',refundConfirmed:'yes'}),/anterior/);
});
test('Estadísticas excluyen devoluciones y entregas pendientes; preservan datos visibles por rol',()=>{
 let s=fixture();s=run(s,'purchase.create',purchase(s));s=run(s,'sale.create',sale(s));const opts={from:'2026-10-01',to:'2026-10-31',financial:true};let r=statisticsReport('statistics',s,opts);assert.equal(r.rows.find(x=>x[0]==='Ventas entregadas')[1],120);assert.equal(r.rows.find(x=>x[0]==='Margen bruto estimado')[1],60);
 s=run(s,'operation.return',{sourceType:'sale',sourceId:s.sales[0].id,date:'2026-10-13',reason:'Devolución de prueba',refundConfirmed:'yes'});r=statisticsReport('statistics',s,opts);assert.equal(r.rows.find(x=>x[0]==='Ventas entregadas')[1],0);assert.equal(statisticsReport('returns',s,opts).rows.length,1);
 assert.ok(!statisticsReport('statistics',s,{...opts,financial:false}).rows.some(x=>x[0].includes('Margen')));
});
