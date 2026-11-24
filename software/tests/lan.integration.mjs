import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db,production} from '../server/firebase.mjs';
import {localConfig} from '../server/local-config.mjs';
import {networkLinks} from '../scripts/network.mjs';
assert.equal(production,false,'La prueba LAN solo utiliza los emuladores locales.');
const link=networkLinks(localConfig.webPort)[0];
assert.ok(link,'Se requiere una conexión de red local.');
const origin=new URL(link.url).origin;
const prefix='lan-test-'+randomUUID();
const sessions=new Map();
async function request(path,{session,body,foreignOrigin}={}){
 const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Chasquero-Client':'local-app',Origin:foreignOrigin||origin,...(sessions.has(session)?{Cookie:sessions.get(session)}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 const cookie=response.headers.get('set-cookie');if(cookie&&session)sessions.set(session,cookie.split(';')[0]);
 const result=response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text();
 return {response,result};
}
try{
 let r=await request('/api/health');assert.equal(r.response.status,200);assert.equal(r.result.mode,'firebase-emulators');console.log('LAN-01 API accesible por la IP actual y el puerto compartido.');
 r=await request('/acceso');assert.equal(r.response.status,200);assert.match(r.result,/Chasquero/);
 const modulePath=r.result.match(/src="([^"]*src\/[^\"]+)"/)?.[1];assert.ok(modulePath,'La página debe cargar su módulo web.');
 r=await request(modulePath);assert.equal(r.response.status,200);assert.match(r.response.headers.get('content-type'),/javascript/);console.log('LAN-02 Página y código de la aplicación disponibles por la misma dirección.');
 r=await request('/api/state');assert.equal(r.response.status,401);
 for(const [session,email] of [['administrador','administracion@chasquero.local'],['almacen','almacen@chasquero.local']]){
  r=await request('/api/login',{session,body:{email,password:'CafeLocal2026!'}});assert.equal(r.response.status,200,JSON.stringify(r.result));
 }
 assert.notEqual(sessions.get('administrador'),sessions.get('almacen'));console.log('LAN-03 Dos sesiones independientes ingresan por HTTP de red con sus perfiles.');
 r=await request('/api/commands',{session:'almacen',body:{type:'contact.save',requestId:prefix,payload:{name:'Proveedor de prueba LAN',type:'proveedor',location:'Prueba temporal de red'}}});
 assert.equal(r.response.status,200,JSON.stringify(r.result));assert.ok(r.result.contacts.find(x=>x.id===prefix));
 r=await request('/api/state',{session:'administrador'});assert.equal(r.response.status,200);assert.equal(r.result.contacts.find(x=>x.id===prefix)?.name,'Proveedor de prueba LAN');console.log('LAN-04 Un registro de almacén aparece en la sesión de administración, compartiendo Firestore.');
 r=await request('/api/commands',{session:'administrador',foreignOrigin:'http://otro-sitio.example',body:{type:'contact.save',requestId:prefix+'-foreign',payload:{name:'No debe guardarse',type:'proveedor'}}});assert.equal(r.response.status,403);console.log('LAN-05 Una página ajena a la red del sistema no puede enviar operaciones.');
 r=await request('/api/commands',{session:'almacen',body:{type:'cash.create',requestId:prefix+'-forbidden',payload:{}}});assert.equal(r.response.status,403);console.log('LAN-06 Almacén conserva sus restricciones de caja desde la conexión LAN.');
 for(const session of sessions.keys()){r=await request('/api/logout',{session,body:{}});assert.equal(r.response.status,200);}
 console.log('6 comprobaciones LAN aprobadas. Se probó la IP de red desde la laptop anfitriona; falta confirmar el acceso desde otro equipo.');
}finally{
 const batch=db.batch();batch.delete(db.doc('contacts/'+prefix));batch.delete(db.doc('audit/'+prefix));await batch.commit();await db.terminate();
}
