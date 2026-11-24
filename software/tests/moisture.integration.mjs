import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { db, production, readState } from '../server/firebase.mjs';
import { COLLECTIONS } from '../server/domain.mjs';
import { localConfig } from '../server/local-config.mjs';
assert.equal(production,false,'Esta prueba solo se ejecuta con emuladores.');
const prefix='humidity-'+randomUUID().slice(0,8),base=`http://127.0.0.1:${localConfig.apiPort}/api`,results=[];
const before=await readState();let cookie='';
async function api(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Chasquero-Client':'local-app',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});const buffer=Buffer.from(await r.arrayBuffer());return {status:r.status,headers:r.headers,buffer,data:r.headers.get('content-type')?.includes('json')?JSON.parse(buffer.toString()):buffer.toString()};}
const cmd=(type,payload,id)=>api('/commands',{type,payload,requestId:`${prefix}-${id}`});
async function check(name,fn){await fn();results.push({name,status:'APROBADA'});console.log('APROBADA: '+name);}
try{
 const login=await api('/login',{email:'administracion@chasquero.local',password:'CafeLocal2026!'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await cmd('contact.save',{name:'Productor de prueba de humedad',type:'proveedor'},'contact')).status,200);
 const payload={contactId:prefix+'-contact',date:'2026-11-24',stage:'pergamino',quality:70,quantity:'50',moisture:'14',price:'980',priceReason:'Tarifa ficticia para comprobar humedad',paid:'100',lotCode:prefix};
 await check('Humedad 14 calcula divisor 56, Semi seco, liquidación 872 y saldo 772',async()=>{
  const r=await cmd('purchase.create',payload,'purchase');assert.equal(r.status,200,JSON.stringify(r.data));const op=r.data.purchases.find(x=>x.id===prefix+'-purchase');
  assert.equal(op.moistureDivisor,56);assert.equal(op.moistureClass,'Semi seco');assert.equal(op.totalCents,87200);assert.equal(op.totalCents-op.paidCents,77200);assert.equal(op.settlementUnits,'0.89');
  assert.equal(r.data.lots.find(x=>x.id===op.lotId).stockGrams,50000);assert.equal(r.data.cash.find(x=>x.sourceId===op.id).signedCents,-10000);
 });
 await check('Un divisor alterado se rechaza y no agrega compras, lotes o caja',async()=>{
  const a=await readState();assert.equal((await cmd('purchase.create',{...payload,lotCode:prefix+'-bad',moistureDivisor:'56.5'},'bad-divisor')).status,409);const b=await readState();assert.deepEqual(a.purchases,b.purchases);assert.deepEqual(a.lots,b.lots);assert.deepEqual(a.cash,b.cash);
 });
 await check('Una lectura 14.99 aplica 14, conserva el original y no redondea el pago',async()=>{
  const r=await cmd('purchase.create',{...payload,lotCode:prefix+'-decimal',moisture:'14.99'},'decimal');assert.equal(r.status,200,JSON.stringify(r.data));
  const op=r.data.purchases.find(x=>x.id===prefix+'-decimal'),lot=r.data.lots.find(x=>x.id===op.lotId);
  assert.equal(op.moisture,14);assert.equal(op.measuredMoisture,14.99);assert.equal(op.moistureDivisor,56);assert.equal(op.totalCents,87200);
  assert.equal(lot.moisture,14);assert.equal(lot.measuredMoisture,14.99);
 });
 await check('Lecturas superiores a 40 exigen un divisor manual válido y especificación',async()=>{
  for(const h of ['41','100.01'])assert.equal((await cmd('purchase.create',{...payload,lotCode:prefix+'-'+h,moisture:h},'unknown-'+h.replace('.','-'))).status,400);
 });
 await check('CSV y PDF conservan clasificación y versión de tabla',async()=>{
  for(const kind of ['purchases','inventory']){
   const csv=await api(`/reports/${kind}?format=csv&q=${prefix}`);assert.equal(csv.status,200);assert.ok(csv.data.includes('Clasificación de humedad'));assert.ok(csv.data.includes('Semi seco'));assert.ok(csv.data.includes('company-2026-11-24'));assert.ok(csv.data.includes('Lectura original %'));assert.ok(csv.data.includes('14.99'));
   const pdf=await api(`/reports/${kind}?format=pdf&q=${prefix}`);assert.equal(pdf.status,200);assert.equal(pdf.buffer.subarray(0,5).toString(),'%PDF-');
  }
 });
 await check('Las compras y lotes anteriores conservan sus valores históricos',async()=>{
  const after=await readState();for(const name of ['purchases','lots'])for(const original of before[name])assert.deepEqual(after[name].find(x=>x.id===original.id),original);
 });
}finally{
 const batch=db.batch();for(const name of COLLECTIONS){const snap=await db.collection(name).get();for(const doc of snap.docs)if(doc.id.startsWith(prefix))batch.delete(doc.ref);}await batch.commit();
 const folder=new URL('../documentacion/Actualizacion_Humedad_2026-11-24/Evidencias/',import.meta.url);await mkdir(folder,{recursive:true});await writeFile(new URL('Integracion.json',folder),JSON.stringify({environment:'Emuladores independientes',apiPort:localConfig.apiPort,executedAt:new Date().toISOString(),results},null,2));await db.terminate();
}
