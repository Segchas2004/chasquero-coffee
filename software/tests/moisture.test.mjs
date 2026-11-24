import test from 'node:test';
import assert from 'node:assert/strict';
import { moistureRule, MOISTURE_TABLE, MOISTURE_TABLE_VERSION } from '../src/moisture.mjs';
import { applyCommand, emptyState } from '../server/domain.mjs';
import { settlePergamino } from '../src/settlement.mjs';

const actor={id:'moisture-admin',name:'Admin',role:'administrador',area:'general',active:true};
function fixture(){
 let state=emptyState(),n=0;
 const run=(type,payload)=>{state=applyCommand(state,{type,payload,requestId:`moisture-test-${++n}`},actor);return state;};
 run('contact.save',{name:'Productor de prueba',type:'proveedor'});
 const payload={contactId:state.contacts[0].id,date:'2026-11-24',stage:'pergamino',quality:70,quantity:'50',moisture:'14',price:'980',priceReason:'Tarifa ficticia de verificación',paid:'100',lotCode:'HUM-001'};
 return {run,payload,state:()=>state};
}
test('La tabla coincide con las cuarenta humedades entregadas, incluido el salto de 29 a 30',()=>{
 const expected=[...Array(13).fill(55.5),56,56.5,57,57.5,58,59,60,60.6,61.2,61.8,62.4,63,63.6,64.2,64.8,65.4,68.5,69.2,69.9,70.6,71.3,72,72.7,73.4,74.1,74.8,75.5];
 assert.equal(MOISTURE_TABLE.length,40);
 for(let h=1;h<=40;h++)assert.equal(moistureRule(h).divisor,expected[h-1],`Humedad ${h}`);
});
test('Clasificación: 1 a 12 Seco, 13 a 15 Semi seco y 16 a 40 Húmedo',()=>{
 for(let h=1;h<=40;h++)assert.equal(moistureRule(h).moistureClass,h<=12?'Seco':h<=15?'Semi seco':'Húmedo');
 assert.equal(moistureRule('1.25').divisor,55.5);
 assert.equal(moistureRule('12.00').moistureClass,'Seco');
});
test('Trunca la humedad y conserva la lectura original sin redondear',()=>{
 for(const [h,integer,divisor,classification] of [['12.5',12,55.5,'Seco'],['14.99',14,56,'Semi seco'],['15.99',15,56.5,'Semi seco'],['29.5',29,65.4,'Húmedo'],['40.99',40,75.5,'Húmedo']]){
  const rule=moistureRule(h);assert.equal(rule.moisture,integer);assert.equal(rule.measuredMoisture,Number(h));assert.equal(rule.divisor,divisor);assert.equal(rule.moistureClass,classification);
 }
 for(const h of ['',null,undefined,'0','0.99','41','99','100.01','abc','1e1','14,5'])assert.equal(moistureRule(h),null,String(h));
});
test('Una compra calcula divisor, clasificación, total, lote y caja en conjunto',()=>{
 const f=fixture(),s=f.run('purchase.create',{...f.payload,moisture:'14.99'}),op=s.purchases[0];
 assert.equal(op.moisture,14);assert.equal(op.measuredMoisture,14.99);assert.equal(s.lots[0].moisture,14);assert.equal(s.lots[0].measuredMoisture,14.99);
 assert.equal(op.moistureDivisor,56);assert.equal(op.moistureClass,'Semi seco');assert.equal(op.moistureTableVersion,MOISTURE_TABLE_VERSION);
 assert.equal(op.settlementUnits,'0.89');assert.equal(op.calculatedCents,87220);assert.equal(op.totalCents,87200);assert.equal(op.paidCents,10000);
 assert.equal(s.lots[0].moistureClass,'Semi seco');assert.equal(s.lots[0].stockGrams,50000);assert.equal(s.cash[0].signedCents,-10000);
});
test('El servidor rechaza un divisor manipulado sin cambiar stock ni caja',()=>{
 const f=fixture(),before=structuredClone(f.state());
 assert.throws(()=>f.run('purchase.create',{...f.payload,moistureDivisor:'56.5'}),/no coincide/);
 assert.deepEqual(f.state(),before);
 const s=f.run('purchase.create',{...f.payload,moistureDivisor:'56.00'});assert.equal(s.purchases[0].totalCents,87200);
});
test('Humedades sin divisor confirmado no generan una compra parcial',()=>{
 const f=fixture(),before=structuredClone(f.state());
 for(const h of ['41','99','0','100.01'])assert.throws(()=>f.run('purchase.create',{...f.payload,moisture:h,moistureDivisor:'56'}),/no tiene un divisor confirmado/);
 assert.deepEqual(f.state(),before);
});
test('Los importes históricos no se recalculan al registrar una compra con la nueva tabla',()=>{
 const f=fixture();f.state().purchases.push({id:'historic',moisture:14,moistureDivisor:56.5,settlementUnits:'0.88',totalCents:86200,paidCents:30000,status:'registrado'});
 const before=structuredClone(f.state().purchases[0]);const s=f.run('purchase.create',f.payload);
 assert.deepEqual(s.purchases.find(x=>x.id==='historic'),before);assert.equal(s.purchases[1].totalCents,87200);
});
test('La fórmula sigue truncando las unidades a dos decimales y el pago a soles enteros',()=>{
 const examples=[[13,'0.90',88200],[14,'0.89',87200],[15,'0.88',86200],[30,'0.72',70500],[40,'0.66',64600]];
 for(const [h,units,total] of examples){const s=settlePergamino('50',moistureRule(h).divisorText,'980');assert.equal(s.settlementUnits,units);assert.equal(s.totalCents,total);}
});
test('Por encima de 40 el divisor manual no baja de 75.5 y exige especificación',()=>{
 for(const d of ['75.49','0','-80','abc','75.555'])assert.equal(moistureRule('41.9',d),null);
 const f=fixture(),before=structuredClone(f.state());
 assert.throws(()=>f.run('purchase.create',{...f.payload,moisture:'41.9',moistureDivisor:'75.5'}),/Especificación/);assert.deepEqual(f.state(),before);
 const s=f.run('purchase.create',{...f.payload,moisture:'41.9',moistureDivisor:'75.5',moistureDivisorReason:'Lectura manual del lote HUM-001 por almacén'});
 assert.equal(s.purchases[0].moisture,41);assert.equal(s.purchases[0].measuredMoisture,41.9);assert.equal(s.purchases[0].moistureDivisor,75.5);assert.equal(s.purchases[0].moistureDivisorSource,'manual');assert.equal(s.purchases[0].totalCents,64600);
});
