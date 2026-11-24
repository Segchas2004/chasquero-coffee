import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {db,production} from '../server/firebase.mjs';
import {COLLECTIONS} from '../server/domain.mjs';
import {localConfig} from '../server/local-config.mjs';
assert.equal(production,false,'La prueba solo puede ejecutarse en emuladores.');
const base=`http://127.0.0.1:${localConfig.apiPort}`;
const prefix=`hu03-${randomUUID().slice(0,8)}`;
const results=[];
let session,contact,purchase,client;
async function api(path,body,cookie=session){
 const res=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Chasquero-Client':'local-app',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
async function login(email){const r=await api('/api/login',{email,password:'CafeLocal2026!'},'');assert.equal(r.status,200,JSON.stringify(r.data));return r.cookie;}
const cmd=(type,payload,suffix,cookie=session)=>api('/api/commands',{type,payload,requestId:`${prefix}-${suffix}`},cookie);
async function check(id,name,fn){try{await fn();results.push({id,name,status:'APROBADA'});console.log(`${id} APROBADA: ${name}`);}catch(e){results.push({id,name,status:'FALLIDA',error:e.message});throw e;}}
try{
 session=await login('administracion@chasquero.local');
 await check('HU03-I1','Registro por API autenticada y persistencia real en Firestore Emulator',async()=>{
  const r=await cmd('contact.save',{name:'Contacto automatizado HU03',type:'proveedor',document:'DEMO-HU03',phone:'000000000',location:'Las Pirias',active:true},'contact');
  assert.equal(r.status,200);contact=r.data.contacts.find(x=>x.id===`${prefix}-contact`);assert.ok(contact);
  const saved=(await db.doc(`contacts/${contact.id}`).get()).data();assert.equal(saved.name,contact.name);assert.equal(saved.document,'DEMO-HU03');assert.equal(saved.active,true);
 });
 await check('HU03-I2','Edición conserva ID, actualiza campos y registra auditoría',async()=>{
  const r=await cmd('contact.save',{...contact,name:'Contacto HU03 editado',phone:'000000001',location:'Chirinos'},'edit');assert.equal(r.status,200);
  const matches=r.data.contacts.filter(x=>x.id===contact.id);assert.equal(matches.length,1);assert.equal(matches[0].phone,'000000001');
  assert.equal((await db.doc(`contacts/${contact.id}`).get()).data().location,'Chirinos');assert.ok(r.data.audit.some(x=>x.id===`${prefix}-edit`));contact=matches[0];
 });
 await check('HU03-I3','Nombre obligatorio y tipo válido se comprueban en el servidor',async()=>{
  assert.equal((await cmd('contact.save',{name:'',type:'proveedor'},'empty')).status,400);
  assert.equal((await cmd('contact.save',{name:'Inválido',type:'invalido'},'invalid')).status,400);
  assert.equal((await db.doc(`contacts/${prefix}-empty`).get()).exists,false);
 });
 await check('HU03-I4','Baja lógica conserva compra previa y bloquea nuevas compras',async()=>{
  const payload={contactId:contact.id,date:'2026-10-27',stage:'coco',quantity:'1',price:'9.20',paid:'0',lotCode:prefix.toUpperCase(),priceReason:'Verificación local del historial HU03'};
  let r=await cmd('purchase.create',payload,'purchase');assert.equal(r.status,200,JSON.stringify(r.data));purchase=r.data.purchases.find(x=>x.id===`${prefix}-purchase`);assert.ok(purchase);
  r=await cmd('contact.save',{...contact,active:false},'disable');assert.equal(r.status,200);assert.equal(r.data.contacts.find(x=>x.id===contact.id).active,false);
  assert.deepEqual(r.data.purchases.find(x=>x.id===purchase.id),purchase);
  assert.equal((await cmd('purchase.create',{...payload,lotCode:`${prefix}-blocked`},'blocked-purchase')).status,400);
  assert.equal((await db.doc(`purchases/${prefix}-blocked-purchase`).get()).exists,false);
 });
 await check('HU03-I5','Un cliente inactivo queda excluido de nuevas ventas',async()=>{
  let r=await cmd('contact.save',{name:'Cliente automatizado HU03',type:'cliente',active:false},'client');assert.equal(r.status,200);client=r.data.contacts.find(x=>x.id===`${prefix}-client`);
  r=await cmd('sale.create',{contactId:client.id,lotId:purchase.lotId,date:'2026-10-27',quantity:'0.1',price:'12',paid:'0',priceReason:'Verificación local de contacto inactivo'},'blocked-sale');assert.equal(r.status,400);assert.match(r.data.error,/cliente.*activo/i);
 });
 await check('HU03-I6','Gerencia, almacén y caja respetan los tipos de contacto autorizados',async()=>{
  const manager=await login('director@chasquero.local'),warehouse=await login('almacen@chasquero.local'),cashier=await login('caja@chasquero.local');
  assert.equal((await cmd('contact.save',{name:'Gerencia HU03',type:'ambos'},'manager',manager)).status,200);
  assert.equal((await cmd('contact.save',{name:'Proveedor HU03',type:'proveedor'},'warehouse',warehouse)).status,200);
  assert.equal((await cmd('contact.save',{name:'Cliente HU03',type:'cliente'},'warehouse-denied',warehouse)).status,403);
  assert.equal((await cmd('contact.save',{name:'Cliente HU03',type:'cliente'},'cashier',cashier)).status,200);
  assert.equal((await cmd('contact.save',{name:'Proveedor HU03',type:'proveedor'},'cashier-denied',cashier)).status,403);
 });
 await check('HU03-I7','Cierre de sesión y nuevo ingreso conservan contacto, estado e historial',async()=>{
  assert.equal((await api('/api/logout',{})).status,200);assert.equal((await api('/api/me',null,'')).status,401);
  session=await login('administracion@chasquero.local');const r=await api('/api/state');assert.equal(r.status,200);
  const restored=r.data.contacts.find(x=>x.id===contact.id);assert.equal(restored.name,'Contacto HU03 editado');assert.equal(restored.phone,'000000001');assert.equal(restored.active,false);assert.deepEqual(r.data.purchases.find(x=>x.id===purchase.id),purchase);
 });
}finally{
 // Remove only disposable records with this run's unique prefix in the local demo.
 const batch=db.batch();for(const collection of COLLECTIONS){const snap=await db.collection(collection).get();for(const doc of snap.docs)if(doc.id.startsWith(prefix))batch.delete(doc.ref);}await batch.commit();
 await writeFile(new URL('./contacts-integration-results.json',import.meta.url),JSON.stringify({environment:'Firebase Authentication y Firestore Emulator',executedAt:new Date().toISOString(),results},null,2));await db.terminate();
}
