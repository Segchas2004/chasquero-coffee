import test from 'node:test';
import assert from 'node:assert/strict';
import { settlePergamino, suggestedDivisor } from '../src/settlement.mjs';
import { applyCommand, emptyState } from '../server/domain.mjs';
test('Ejemplo confirmado: 50 / 56.5 -> 0.88 × 980 -> 862.40 -> 862 soles',()=>{
 const s=settlePergamino('50','56.5','980');
 assert.equal(s.settlementUnits,'0.88');assert.equal(s.calculatedCents,86240);assert.equal(s.totalCents,86200);assert.equal(s.discardedCents,40);
});
test('Trunca las unidades y los soles incluso cuando redondear aumentaría el pago',()=>{
 const s=settlePergamino('55.999','56','999.99');assert.equal(s.settlementUnits,'0.99');assert.equal(s.totalCents,98900);
 assert.equal(settlePergamino('16.8','56','1000').settlementUnits,'0.30');
 assert.equal(settlePergamino('50','61.8','980').settlementUnits,'0.80');
});
test('No inventa divisores para humedades no confirmadas y no redondea el divisor',()=>{
 assert.equal(suggestedDivisor('14'),'56');assert.equal(suggestedDivisor('21'),'60.6');
 assert.equal(suggestedDivisor('16'),'57');assert.equal(suggestedDivisor('14.5'),'56');assert.equal(suggestedDivisor('41'),'');
 for(const args of [['50','0','980'],['-1','56','980'],['50','','980'],['50','56','abc']])assert.throws(()=>settlePergamino(...args));
});
test('La compra guarda la liquidación confirmada y caja paga exactamente 862 soles',()=>{
 const admin={id:'admin',role:'administrador',area:'general',name:'Admin',active:true};let s=emptyState();s.users=[admin];
 let n=0;const command=(type,payload)=>{s=applyCommand(s,{type,payload,requestId:'settlement-command-'+ ++n},admin);};
 command('contact.save',{name:'Productor',type:'proveedor'});
 command('price.save',{stage:'pergamino',quality:70,kind:'compra',amount:'980',reason:'Ejemplo confirmado por la empresa'});
 const payload={contactId:s.contacts[0].id,stage:'pergamino',quality:70,quantity:'50',moisture:'15',moistureDivisor:'56.5',price:'980',priceId:s.prices[0].id,priceVersion:1,paid:'862',date:'2026-10-13',lotCode:'LIQ-001'};
 command('purchase.create',payload);
 assert.equal(s.purchases[0].totalCents,86200);assert.equal(s.purchases[0].settlementUnits,'0.88');
 assert.equal(s.purchases[0].priceUnit,'liquidacion');assert.equal(s.cash[0].signedCents,-86200);assert.equal(s.lots[0].stockGrams,50000);
 const before=structuredClone(s);assert.throws(()=>applyCommand(s,{type:'purchase.create',payload:{...payload,lotCode:'LIQ-002',paid:'862.40'},requestId:'overpaid-settlement'},admin),/superar/);assert.deepEqual(s,before);
 command('price.save',{id:s.prices[0].id,stage:'pergamino',quality:70,kind:'compra',amount:'1000',version:1,reason:'Cambio de tarifa autorizado'});
 assert.equal(s.purchases[0].unitPriceCents,98000);assert.equal(s.purchases[0].moistureDivisor,56.5);assert.equal(s.purchases[0].totalCents,86200);
});
