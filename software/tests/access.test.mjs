import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { localConfig } from '../server/local-config.mjs';
import { auth,db,readState } from '../server/firebase.mjs';
const base=`http://127.0.0.1:${localConfig.apiPort}`,prefix='access-'+randomUUID();const results=[];
async function api(route,body,cookie=''){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Chasquero-Client':'local-app',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});const data=r.headers.get('content-type')?.includes('json')?await r.json():await r.text();return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function login(email,portal,password='CafeLocal2026!'){const r=await api('/api/login',{email,portal,password});assert.equal(r.status,200,JSON.stringify(r.data));return r.cookie;}
async function check(name,fn){await fn();results.push({name,status:'APROBADA'});console.log('APROBADA: '+name);}
let created;
try{
 await check('Portal incorrecto no concede acceso',async()=>assert.equal((await api('/api/login',{email:'almacen@chasquero.local',password:'CafeLocal2026!',portal:'administrador'})).status,403));
 const admin=await login('administracion@chasquero.local','administrador'),manager=await login('director@chasquero.local','gerente'),worker=await login('almacen@chasquero.local','trabajador');
 await check('Servidor deniega precios a gerente y trabajador',async()=>{for(const cookie of [manager,worker])assert.equal((await api('/api/commands',{type:'price.save',requestId:prefix+'-price',payload:{kind:'compra',stage:'coco',amount:'1',reason:'Intento sin permiso'}},cookie)).status,403);});
 await check('Servidor deniega auditoría a trabajador',async()=>assert.equal((await api('/api/reports/audit',null,worker)).status,403));
 await check('Cuenta desactivada pierde una sesión ya abierta',async()=>{
 const p={name:'Prueba de sesión activa',email:prefix+'@chasquero.local',password:'PruebaLocal2026!',role:'trabajador',area:'caja',active:true};
 const r=await api('/api/users',{requestId:prefix+'-create',payload:p},admin);assert.equal(r.status,200);created=r.data.users.find(x=>x.email===p.email);
 const cookie=await login(p.email,'trabajador',p.password);assert.equal((await api('/api/state',null,cookie)).status,200);
 assert.equal((await api('/api/users',{requestId:prefix+'-disable',payload:{...created,active:false}},admin)).status,200);
 assert.equal((await api('/api/state',null,cookie)).status,403);
 });
 await check('CSV de auditoría respeta tabla, actor y acción',async()=>{
 const r=await api(`/api/reports/audit?from=2026-01-01&to=2026-12-31&collection=users&action=delete&actor=local-administrador&q=${created.id}`,null,admin);assert.equal(r.status,200);const rows=r.data.trim().split('\n');assert.equal(rows.length,2);assert.ok(r.data.includes('LOCAL DE PRUEBA'));assert.ok(r.data.includes(created.id));
 });
 await check('Logout retira la cookie del navegador',async()=>{const r=await api('/api/logout',{},worker);assert.equal(r.status,200);assert.ok(r.cookie.endsWith('='));});
}finally{
 if(created){await db.doc('users/'+created.id).delete();await auth.deleteUser(created.id);const state=await readState();const batch=db.batch();for(const a of state.audit)if(a.id.startsWith(prefix)||a.actorId===created.id)batch.delete(db.doc('audit/'+a.id));await batch.commit();}
 await writeFile('tests/access-results.json',JSON.stringify({executedAt:new Date().toISOString(),results},null,2));await db.terminate();
}
