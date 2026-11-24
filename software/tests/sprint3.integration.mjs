import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {db,production,readState} from '../server/firebase.mjs';
import {COLLECTIONS} from '../server/domain.mjs';
import {localConfig} from '../server/local-config.mjs';
assert.equal(production,false,'Esta prueba solo utiliza emuladores locales.');
const prefix=`s3-${randomUUID().slice(0,8)}`,base=`http://127.0.0.1:${localConfig.apiPort}`,results=[];
let cookie,contact,purchase,child,pending;
async function api(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Chasquero-Client':'local-app',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const buffer=Buffer.from(await r.arrayBuffer());return {status:r.status,headers:r.headers,data:r.headers.get('content-type')?.includes('json')?JSON.parse(buffer.toString()):buffer.toString(),buffer};}
const cmd=(type,payload,suffix)=>api('/api/commands',{type,payload,requestId:`${prefix}-${suffix}`});
async function check(id,name,fn){try{await fn();results.push({id,name,status:'APROBADA'});console.log(`${id} APROBADA: ${name}`);}catch(e){results.push({id,name,status:'FALLIDA',error:e.message});throw e;}}
try{
 const login=await api('/api/login',{email:'administracion@chasquero.local',password:'CafeLocal2026!'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
 let r=await cmd('contact.save',{name:'Proveedor automatizado Sprint 3',type:'proveedor',location:prefix},'contact');assert.equal(r.status,200);contact=r.data.contacts.find(x=>x.id===`${prefix}-contact`);
 const buy={contactId:contact.id,date:'2026-11-03',stage:'pergamino',quality:70,quantity:'50',moisture:'15',moistureDivisor:'56.5',price:'980',priceReason:'Tarifa ficticia de verificación del Sprint 3',paid:'300',lotCode:`${prefix}-PER`,origin:prefix};
 await check('S3-I1','Compra parcial persistida con lote, saldo y único egreso de caja',async()=>{
  r=await cmd('purchase.create',buy,'purchase');assert.equal(r.status,200,JSON.stringify(r.data));purchase=r.data.purchases.find(x=>x.id===`${prefix}-purchase`);
  assert.equal(purchase.totalCents,86200);assert.equal(purchase.paidCents,30000);assert.equal(purchase.totalCents-purchase.paidCents,56200);
  assert.equal(r.data.lots.find(x=>x.id===purchase.lotId).stockGrams,50000);assert.equal(r.data.cash.filter(x=>x.sourceId===purchase.id).length,1);assert.equal(r.data.cash.find(x=>x.sourceId===purchase.id).signedCents,-30000);
  assert.equal((await db.doc(`purchases/${purchase.id}`).get()).data().totalCents,86200);
 });
 await check('S3-I2','Reintento no duplica compra y se rechazan pago excesivo y código repetido',async()=>{
  r=await cmd('purchase.create',buy,'purchase');assert.equal(r.status,200);assert.equal(r.data.purchases.filter(x=>x.id===purchase.id).length,1);assert.equal(r.data.cash.filter(x=>x.sourceId===purchase.id).length,1);
  assert.equal((await cmd('purchase.create',{...buy,lotCode:`prefix-${prefix}`,paid:'863'},'overpay')).status,400);
  assert.equal((await cmd('purchase.create',buy,'duplicate')).status,400);
 });
 const process={lotId:purchase.lotId,date:'2026-11-03',inputQuantity:'20',outputQuantity:'16',stage:'verde',lotCode:`${prefix}-VER`};
 await check('S3-I3','Procesamiento persistido descuenta stock y genera lote hijo con merma medida',async()=>{
  r=await cmd('process.create',process,'process');assert.equal(r.status,200,JSON.stringify(r.data));const p=r.data.processes.find(x=>x.id===`${prefix}-process`);child=r.data.lots.find(x=>x.id===p.outputLotId);
  assert.equal(r.data.lots.find(x=>x.id===purchase.lotId).stockGrams,30000);assert.equal(child.stockGrams,16000);assert.equal(child.parentId,purchase.lotId);assert.equal(child.origin,prefix);assert.equal(p.wasteGrams,4000);
  assert.equal((await db.doc(`processes/${p.id}`).get()).data().wasteGrams,4000);
 });
 await check('S3-I4','Salida mayor que entrada y consumo excesivo se rechazan sin alterar lotes',async()=>{
  const before=await readState();assert.equal((await cmd('process.create',{...process,outputQuantity:'21',lotCode:`${prefix}-BAD`},'invalid-output')).status,400);
  assert.equal((await cmd('process.create',{...process,inputQuantity:'31',lotCode:`${prefix}-BAD2`},'invalid-input')).status,400);
  const after=await readState();assert.deepEqual(after.lots,before.lots);assert.deepEqual(after.processes,before.processes);
 });
 await check('S3-I5','Compra pendiente ingresa al recibir sin repetir el pago inicial',async()=>{
  r=await cmd('purchase.create',{contactId:contact.id,date:'2026-11-03',stage:'coco',quantity:'10',price:'10',paid:'20',priceReason:'Prueba de recepción pendiente del Sprint 3',lotCode:`${prefix}-PEND`,deliveryStatus:'pendiente'},'pending');assert.equal(r.status,200);pending=r.data.purchases.find(x=>x.id===`${prefix}-pending`);assert.equal(r.data.lots.find(x=>x.id===pending.lotId).stockGrams,0);
  r=await cmd('purchase.receive',{id:pending.id,date:'2026-11-03'},'receive');assert.equal(r.status,200);assert.equal(r.data.lots.find(x=>x.id===pending.lotId).stockGrams,10000);assert.equal(r.data.cash.filter(x=>x.sourceId===pending.id).length,1);
 });
 await check('S3-I6','Exportación de inventario respeta presentación, procedencia y bajo umbral',async()=>{
  r=await api(`/api/reports/inventory?format=csv&q=${prefix}&stage=verde&availability=low`);assert.equal(r.status,200);const lines=r.data.trim().split('\n');assert.equal(lines.length,2);assert.equal(lines[1].split(';')[1],'"'+`${prefix}-VER`.toUpperCase()+'"');
 });
 await check('S3-I7','PDF de procesamiento exporta una tabla válida con el filtro del lote',async()=>{
  r=await api(`/api/reports/processes?format=pdf&q=${prefix}`);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/pdf/);assert.equal(r.buffer.subarray(0,5).toString(),'%PDF-');
 });
}finally{
 const batch=db.batch();for(const name of COLLECTIONS){const snap=await db.collection(name).get();for(const doc of snap.docs)if(doc.id.startsWith(prefix))batch.delete(doc.ref);}await batch.commit();
 await writeFile(new URL('./sprint3-integration-results.json',import.meta.url),JSON.stringify({environment:'Firebase Authentication y Firestore Emulator',executedAt:new Date().toISOString(),results},null,2));await db.terminate();
}
