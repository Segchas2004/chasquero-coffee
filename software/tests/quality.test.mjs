import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, emptyState, coffeeQuality } from '../server/domain.mjs';
const admin={id:'admin',name:'Admin',email:'test@example.com',role:'administrador',area:'general',active:true};
const worker={id:'worker',name:'Almacén',role:'trabajador',area:'almacen',active:true};
let sequence=0;
const run=(s,type,payload,actor=admin)=>applyCommand(s,{type,payload,requestId:'quality-test-'+ ++sequence},actor);
const price=(quality,kind='compra',amount='10')=>({stage:'pergamino',quality,kind,amount,reason:'Tarifa para prueba de calidad'});
function fixture(){let s=emptyState();s.users=[admin,worker];s=run(s,'contact.save',{name:'Contacto de prueba',type:'ambos'});s.contactId=s.contacts[0].id;return s;}
test('Calidades: admite los 41 enteros de 80 a 40 y rechaza valores inválidos',()=>{
 for(let q=80;q>=40;q--)assert.equal(coffeeQuality('pergamino',q),q);
 for(const q of [undefined,null,'',39,81,70.5,'abc'])assert.throws(()=>coffeeQuality('pergamino',q));
 assert.equal(coffeeQuality('coco',undefined),null);
});
test('Tarifas: cada calidad admite compra y venta independientes sin duplicados',()=>{
 let s=fixture();for(const q of [80,79,40])for(const kind of ['compra','venta'])s=run(s,'price.save',price(q,kind));
 assert.equal(s.prices.length,6);assert.throws(()=>run(s,'price.save',price(80)),/existe/);
});
test('Compra: aplica la tarifa de la calidad exacta y la conserva en el lote',()=>{
 let s=run(fixture(),'price.save',price(80));s=run(s,'price.save',price(79,'compra','9'));
 const p=s.prices.find(x=>x.quality===79);
 s=run(s,'purchase.create',{contactId:s.contactId,stage:'pergamino',quality:79,date:'2026-10-13',lotCode:'Q79',quantity:'112',moisture:'13',moistureDivisor:'55.5',price:'9',paid:'0',priceId:p.id,priceVersion:p.version},worker);
 assert.equal(s.purchases[0].totalCents,1800);assert.equal(s.lots[0].quality,79);
 const wrong=s.prices.find(x=>x.quality===80);
 assert.throws(()=>run(s,'purchase.create',{contactId:s.contactId,stage:'pergamino',quality:79,date:'2026-10-13',lotCode:'WRONG',quantity:'1',price:'10',priceId:wrong.id,priceVersion:wrong.version},worker),/precio/);
});
test('Venta: utiliza la calidad del lote y conserva importes tras cambiar tarifa',()=>{
 let s=fixture();s=run(s,'price.save',price(80));s=run(s,'price.save',price(80,'venta','15'));
 const buy=s.prices.find(x=>x.kind==='compra'),sell=s.prices.find(x=>x.kind==='venta');
 s=run(s,'purchase.create',{contactId:s.contactId,stage:'pergamino',quality:80,date:'2026-10-13',lotCode:'Q80',quantity:'112',moisture:'13',moistureDivisor:'55.5',price:'10',paid:'0',priceId:buy.id,priceVersion:1});
 const sale={contactId:s.contactId,lotId:s.lots[0].id,date:'2026-10-13',quantity:'1',price:'15',paid:'0',priceId:sell.id,priceVersion:1};
 assert.throws(()=>run(s,'sale.create',{...sale,quality:79}),/coincidir/);
 s=run(s,'sale.create',sale);assert.equal(s.sales[0].quality,80);
 s=run(s,'price.save',{...price(80,'venta','16'),id:sell.id,version:1});
 assert.equal(s.sales[0].unitPriceCents,1500);assert.equal(s.sales[0].totalCents,1500);
});
test('Migración: administrador clasifica lote antiguo sin cambiar compras históricas',()=>{
 let s=fixture();s.lots.push({id:'legacy-lot',stage:'pergamino',code:'OLD',stockGrams:1000,status:'activo'});
 s.purchases.push({id:'historic',lotId:'legacy-lot',totalCents:1000});
 assert.throws(()=>run(s,'lot.classify',{id:'legacy-lot',quality:70,reason:'Clasificación verificada'},worker),/permiso/);
 s=run(s,'lot.classify',{id:'legacy-lot',quality:70,reason:'Clasificación verificada'});
 assert.equal(s.lots[0].quality,70);assert.equal(s.purchases[0].quality,undefined);assert.equal(s.purchases[0].totalCents,1000);
 assert.throws(()=>run(s,'lot.classify',{id:'legacy-lot',quality:80,reason:'Cambiar arbitrariamente'}),/antiguos/);
 assert.equal(s.audit.at(-1).changes[0].after.quality,70);
});
