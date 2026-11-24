import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { db, production, readState } from '../server/firebase.mjs';
import { COLLECTIONS } from '../server/domain.mjs';
import { localConfig } from '../server/local-config.mjs';
assert.equal(production,false,'Solo se prueba con emuladores.');
const prefix='drying-'+randomUUID().slice(0,8),base=`http://127.0.0.1:${localConfig.apiPort}/api`,results=[],before=await readState();let cookie='';
async function api(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Chasquero-Client':'local-app',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});const buffer=Buffer.from(await r.arrayBuffer());return {status:r.status,headers:r.headers,buffer,data:r.headers.get('content-type')?.includes('json')?JSON.parse(buffer.toString()):buffer.toString()};}
const cmd=(type,payload,id)=>api('/commands',{type,payload,requestId:`${prefix}-${id}`});
async function login(email){const r=await api('/login',{email,password:'CafeLocal2026!'});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];}
async function check(name,fn){await fn();results.push({name,status:'APROBADA'});console.log('APROBADA: '+name);}
let wetId,dryId,processId;
try{
 await login('administracion@chasquero.local');
 assert.equal((await cmd('contact.save',{name:'Contraparte ficticia de secado',type:'ambos'},'contact')).status,200);
 const purchase={contactId:prefix+'-contact',date:'2026-11-24',stage:'pergamino',quality:70,quantity:'50',moisture:'41.9',moistureDivisor:'75.5',moistureDivisorReason:'Lote de prueba, divisor manual confirmado por almacén',price:'980',priceReason:'Tarifa ficticia para pruebas',paid:'100',lotCode:prefix};
 await check('Divisor manual bajo 75.5 se bloquea sin movimientos',async()=>{
  const a=await readState();const r=await cmd('purchase.create',{...purchase,moistureDivisor:'75.49'},'bad');assert.equal(r.status,400);const b=await readState();for(const k of ['purchases','lots','cash'])assert.deepEqual(a[k],b[k]);
 });
 await check('Compra manual de 41.9 aplica 41, mínimo 75.5 y especificación auditada',async()=>{
  const r=await cmd('purchase.create',purchase,'purchase');assert.equal(r.status,200,JSON.stringify(r.data));const op=r.data.purchases.find(x=>x.id===prefix+'-purchase');wetId=op.lotId;assert.equal(op.totalCents,64600);assert.equal(op.moisture,41);assert.equal(op.measuredMoisture,41.9);assert.equal(op.moistureDivisorSource,'manual');
 });
 const sending={lotId:wetId,date:'2026-11-24',inputQuantity:'30',expectedQuantity:'20',expectedMoisture:'12.9',expectedPrice:'2000',expectedPriceUnit:'liquidacion',expectedCost:'50',specification:'Secador solar, lote de prueba y encargado de almacén'};
 await check('Almacén envía a secado y separa stock con fecha, análisis y responsable',async()=>{
  await login('almacen@chasquero.local');const r=await cmd('drying.start',sending,'start');assert.equal(r.status,200,JSON.stringify(r.data));processId=prefix+'-start';const s=await readState(),process=s.processes.find(x=>x.id===processId);assert.equal(process.status,'secando');assert.equal(process.inputGrams,30000);assert.equal(process.estimate.revenueCents,72000);assert.equal(s.lots.find(x=>x.id===wetId).stockGrams,20000);assert.equal(process.estimate.marginCents,28240);assert.equal(process.createdBy,'local-almacen');
 });
 await check('Envío no editable, sin doble salida y sin permiso para caja',async()=>{
  const r=await cmd('drying.start',sending,'double-send');assert.equal(r.status,400);await login('caja@chasquero.local');assert.equal((await cmd('drying.finish',{id:processId},'cashier')).status,403);
 });
 await check('Retorno crea lote seco vinculado, merma 12 kg y costo conservado',async()=>{
  await login('almacen@chasquero.local');const payload={id:processId,date:'2026-11-25',outputQuantity:'18',moisture:'12.9',quality:72,dryingCost:'60',referencePrice:'2000',lotCode:prefix+'-seco'};
  const r=await cmd('drying.finish',payload,'finish');assert.equal(r.status,200,JSON.stringify(r.data));const s=await readState(),p=s.processes.find(x=>x.id===processId);dryId=p.outputLotId;const lot=s.lots.find(x=>x.id===dryId);assert.equal(lot.parentId,wetId);assert.equal(lot.stockGrams,18000);assert.equal(lot.valueCents,44760);assert.equal(lot.moisture,12);assert.equal(lot.measuredMoisture,12.9);assert.equal(lot.quality,72);assert.equal(p.wasteGrams,12000);assert.equal(p.referenceRevenueCents,64000);assert.equal(p.referenceMarginCents,19240);assert.equal((await cmd('drying.finish',payload,'finish-again')).status,400);assert.equal(s.purchases.find(x=>x.id===prefix+'-purchase').totalCents,64600);assert.equal(s.cash.filter(x=>x.sourceId===prefix+'-purchase').length,1);
 });
 await check('Venta del lote seco usa la misma fórmula, costo real y margen',async()=>{
  await login('administracion@chasquero.local');const r=await cmd('sale.create',{contactId:prefix+'-contact',lotId:dryId,date:'2026-11-25',quantity:'18',price:'2000',priceReason:'Tarifa seca ficticia para verificar liquidación',paid:'0'},'sale');assert.equal(r.status,200,JSON.stringify(r.data));const op=r.data.sales.find(x=>x.id===prefix+'-sale');assert.equal(op.priceUnit,'liquidacion');assert.equal(op.settlementUnits,'0.32');assert.equal(op.totalCents,64000);assert.equal(op.costCents,44760);assert.equal(op.totalCents-op.costCents,19240);
 });
 await check('Reportes CSV y PDF incluyen secado, especificación, humedades, merma y valoración',async()=>{
  const csv=await api(`/reports/processes?format=csv&q=${prefix}`);assert.equal(csv.status,200);for(const value of ['secado','Especificación envío','41','12','Costo técnico secado PEN','Valoración retorno PEN'])assert.ok(csv.data.includes(value),value);
  const pdf=await api(`/reports/processes?format=pdf&q=${prefix}`);assert.equal(pdf.status,200);assert.equal(pdf.buffer.subarray(0,5).toString(),'%PDF-');
 });
 await check('El flujo conserva todos los registros de negocio anteriores',async()=>{
  const after=await readState();for(const k of ['purchases','sales','lots','processes','cash'])for(const original of before[k])assert.deepEqual(after[k].find(x=>x.id===original.id),original);
 });
}finally{
 const batch=db.batch();for(const k of COLLECTIONS){const snap=await db.collection(k).get();for(const doc of snap.docs)if(doc.id.startsWith(prefix))batch.delete(doc.ref);}await batch.commit();
 const folder=new URL('../documentacion/Actualizacion_Humedad_2026-11-24/Evidencias/',import.meta.url);await mkdir(folder,{recursive:true});await writeFile(new URL('Secado_integracion.json',folder),JSON.stringify({environment:'Emuladores independientes',executedAt:new Date().toISOString(),results},null,2));await db.terminate();
}
