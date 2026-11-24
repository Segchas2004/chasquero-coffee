import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, emptyState } from '../server/domain.mjs';
import { dryingEstimate } from '../src/drying.mjs';
const admin={id:'admin',name:'Admin',role:'administrador',active:true},stock={id:'stock',role:'trabajador',area:'almacen',active:true},cash={id:'cash',role:'trabajador',area:'caja',active:true};
let n=0;
const run=(s,type,payload,actor=admin,requestId='drying-test-'+ ++n)=>applyCommand(s,{type,payload,requestId},actor);
function fixture(){let s=run(emptyState(),'contact.save',{name:'Productor',type:'ambos'});s=run(s,'purchase.create',{contactId:s.contacts[0].id,stage:'pergamino',quality:70,quantity:'100',moisture:'30.9',price:'1000',priceReason:'Tarifa ficticia para pruebas',paid:'100',date:'2026-11-24',lotCode:'HUMEDO'});return s;}
const sending=s=>({lotId:s.lots[0].id,date:'2026-11-24',inputQuantity:'60',expectedQuantity:'48',expectedMoisture:'12.9',expectedPrice:'2000',expectedPriceUnit:'liquidacion',expectedCost:'50',specification:'Lote HÚMEDO, secador solar, encargado de almacén'});
const finishing=s=>({id:s.processes[0].id,date:'2026-11-25',outputQuantity:'45',moisture:'12.9',quality:72,dryingCost:'60',referencePrice:'2000',lotCode:'SECO'});

test('El análisis previo distingue margen y pérdida, no modifica inventario ni compra',()=>{
 const s=fixture(),before=structuredClone(s),e=dryingEstimate(s.lots[0],sending(s));
 assert.equal(s.purchases[0].totalCents,145000);assert.equal(e.costCents,87000);assert.equal(e.revenueCents,172000);assert.equal(e.marginCents,80000);assert.equal(e.wasteGrams,12000);assert.equal(e.breakEvenCentsPerKg,1917);assert.deepEqual(s,before);
 assert.ok(dryingEstimate(s.lots[0],{...sending(s),expectedPrice:'10'}).marginCents<0);
});
test('La simulación permite comprobar la fórmula de liquidación explícitamente',()=>{
 const s=fixture(),e=dryingEstimate(s.lots[0],{...sending(s),expectedPriceUnit:'liquidacion',expectedPrice:'1000'});
 assert.equal(e.revenueCents,86000);assert.equal(e.marginCents,-6000);
});
test('Enviar a secado separa peso y costo, conserva compra y caja y registra responsable',()=>{
 const s=fixture(),next=run(s,'drying.start',sending(s),stock,'drying-send-once');
 assert.equal(next.lots[0].stockGrams,40000);assert.equal(next.lots[0].valueCents,58000);assert.equal(next.processes[0].status,'secando');assert.equal(next.processes[0].costCents,87000);assert.equal(next.processes[0].createdBy,'stock');assert.equal(next.processes[0].outputLotId,null);assert.deepEqual(next.purchases,s.purchases);assert.deepEqual(next.cash,s.cash);
 assert.deepEqual(run(next,'drying.start',sending(s),stock,'drying-send-once'),next);
});
test('El café enviado no puede venderse otra vez ni enviarse por encima del disponible',()=>{
 let s=fixture();s=run(s,'drying.start',sending(s));const before=structuredClone(s);
 assert.throws(()=>run(s,'drying.start',{...sending(s),inputQuantity:'60'}),/existencias/);
 assert.throws(()=>run(s,'sale.create',{contactId:s.contacts[0].id,lotId:s.lots[0].id,date:'2026-11-24',quantity:'50',price:'30',priceReason:'Tarifa ficticia',paid:'0'}),/existencias/);assert.deepEqual(s,before);
});
test('El secado respeta las reservas de ventas pendientes',()=>{
 let s=fixture();s=run(s,'sale.create',{contactId:s.contacts[0].id,lotId:s.lots[0].id,date:'2026-11-24',quantity:'50',price:'30',priceReason:'Tarifa ficticia',paid:'0',deliveryStatus:'pendiente'});
 assert.throws(()=>run(s,'drying.start',sending(s)),/existencias/);
});
test('El pesaje final crea un lote relacionado con merma real, nueva calidad y costo',()=>{
 let s=fixture();s=run(s,'drying.start',sending(s));const before=structuredClone(s),p=finishing(s);s=run(s,'drying.finish',p,stock,'drying-finish-once');
 const out=s.lots[1],process=s.processes[0];assert.equal(out.stockGrams,45000);assert.equal(out.valueCents,93000);assert.equal(out.parentId,s.lots[0].id);assert.equal(out.moisture,12);assert.equal(out.measuredMoisture,12.9);assert.equal(out.moistureClass,'Seco');assert.equal(out.quality,72);assert.equal(process.wasteGrams,15000);assert.equal(process.estimate.outputGrams,48000);assert.equal(process.status,'registrado');assert.equal(process.completedBy,'stock');assert.deepEqual(s.purchases,before.purchases);assert.deepEqual(s.cash,before.cash);
 assert.deepEqual(run(s,'drying.finish',p,stock,'drying-finish-once'),s);assert.throws(()=>run(s,'drying.finish',p),/pendiente/);
});
test('Un pesaje inválido no cambia pesos, costos, caja ni bitácora',()=>{
 let s=fixture();s=run(s,'drying.start',sending(s));const before=structuredClone(s);
 for(const extra of [{outputQuantity:'61'},{moisture:'16'},{moisture:'0'},{date:'2026-11-23'},{dryingCost:'-1'},{quality:'81'},{lotCode:'HUMEDO'}])assert.throws(()=>run(s,'drying.finish',{...finishing(s),...extra}));assert.deepEqual(s,before);
});
test('Caja no procesa secados; almacén no cancela y dirección exige retorno íntegro',()=>{
 let s=fixture();assert.throws(()=>run(s,'drying.start',sending(s),cash),/permiso/);s=run(s,'drying.start',sending(s));
 assert.throws(()=>run(s,'drying.finish',finishing(s),cash),/permiso/);
 const p={id:s.processes[0].id,date:'2026-11-24',reason:'No se llegó a secar el café',restoredConfirmed:'yes'};
 assert.throws(()=>run(s,'drying.cancel',p,stock),/permiso/);assert.throws(()=>run(s,'drying.cancel',{...p,restoredConfirmed:''}),/íntegramente/);
 s=run(s,'drying.cancel',p,admin,'drying-cancel-once');assert.equal(s.lots[0].stockGrams,100000);assert.equal(s.lots[0].valueCents,145000);assert.equal(s.processes[0].status,'anulado');assert.deepEqual(run(s,'drying.cancel',p,admin,'drying-cancel-once'),s);
});
test('No se trilla pergamino húmedo ni se anula su compra mientras está en secado',()=>{
 let s=fixture();assert.throws(()=>run(s,'process.create',{lotId:s.lots[0].id,date:'2026-11-24',inputQuantity:'10',outputQuantity:'8',stage:'verde',lotCode:'VERDE'}),/húmedo/);
 s=run(s,'drying.start',sending(s));assert.throws(()=>run(s,'operation.void',{sourceType:'purchase',sourceId:s.purchases[0].id,date:'2026-11-24',reason:'Intento de anular'}),/salidas/);
 assert.throws(()=>run(s,'operation.void',{sourceType:'process',sourceId:s.processes[0].id,date:'2026-11-24',reason:'Intento de anular'}),/cancelar secado/);
});
test('Vender el lote seco usa peso real y costo de compra más secado sin cambiar la compra',()=>{
 let s=fixture();s=run(s,'drying.start',sending(s));s=run(s,'drying.finish',finishing(s));const before=structuredClone(s.purchases);
 s=run(s,'sale.create',{contactId:s.contacts[0].id,lotId:s.lots[1].id,date:'2026-11-25',quantity:'45',price:'2000',priceReason:'Precio seco ficticio para verificación',paid:'0'});
 assert.equal(s.sales[0].totalCents,162000);assert.equal(s.sales[0].costCents,93000);assert.equal(s.sales[0].totalCents-s.sales[0].costCents,69000);assert.deepEqual(s.purchases,before);
});
test('Caja necesita una tarifa por rendimiento para vender un lote que volvió de secado',()=>{
 let s=fixture();s=run(s,'drying.start',sending(s));s=run(s,'drying.finish',finishing(s));
 s=run(s,'price.save',{stage:'pergamino',quality:72,kind:'venta',amount:'20',reason:'Tarifa antigua por kilo para probar rechazo'});
 const old=s.prices[0],payload={contactId:s.contacts[0].id,lotId:s.lots[1].id,date:'2026-11-25',quantity:'45',price:'20',priceId:old.id,priceVersion:old.version,paid:'0'};
 assert.throws(()=>run(s,'sale.create',payload,cash),/precio cambió/);
 s=run(s,'price.save',{id:old.id,version:old.version,stage:'pergamino',quality:72,kind:'venta',unit:'liquidacion',amount:'2000',reason:'Precio seco por rendimiento confirmado para la prueba'});
 const price=s.prices[0];s=run(s,'sale.create',{...payload,price:'2000',priceId:price.id,priceVersion:price.version},cash);
 assert.equal(s.sales[0].totalCents,162000);assert.equal(s.sales[0].priceUnit,'liquidacion');
});
test('La anulación del secado restaura el costo original y exige revertir antes sus ventas',()=>{
 let s=fixture();s=run(s,'drying.start',sending(s));s=run(s,'drying.finish',finishing(s));
 s=run(s,'sale.create',{contactId:s.contacts[0].id,lotId:s.lots[1].id,date:'2026-11-25',quantity:'10',price:'2000',priceReason:'Tarifa seca de prueba',paid:'0'});
 const p={sourceType:'process',sourceId:s.processes[0].id,date:'2026-11-25',reason:'Corrección del pesaje de prueba'};
 assert.throws(()=>run(s,'operation.void',p),/salidas/);
 s=run(s,'operation.void',{sourceType:'sale',sourceId:s.sales[0].id,date:'2026-11-25',reason:'Reversión antes del proceso'});s=run(s,'operation.void',p);
 assert.equal(s.lots[0].stockGrams,100000);assert.equal(s.lots[0].valueCents,145000);assert.equal(s.lots[1].stockGrams,0);assert.equal(s.lots[1].valueCents,0);assert.equal(s.processes[0].status,'anulado');
});
