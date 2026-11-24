import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { auth, db, readState } from '../server/firebase.mjs';
import { COLLECTIONS } from '../server/domain.mjs';

import { localConfig } from '../server/local-config.mjs';
const base = `http://127.0.0.1:${localConfig.apiPort}`;
const prefix = `qa-${randomUUID().slice(0, 8)}`;
const results = [];
const before = await readState();
let createdUser;
async function api(path, body, cookie = '') {
  const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Chasquero-Client': 'local-app', Cookie: cookie }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await r.text();
  return { status: r.status, headers: r.headers, data: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
async function login(email) {
  const r = await api('/api/login', {email, password: 'CafeLocal2026!'});
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.headers.get('set-cookie').split(';')[0];
}
async function check(id, name, fn) {
  try { await fn(); results.push({id, name, status:'APROBADA'}); console.log(`${id} APROBADA: ${name}`); }
  catch(e) { results.push({id, name, status:'FALLIDA', error:e.message}); throw e; }
}
let director, warehouse;
const cmd = (type, payload, suffix, cookie = director) => api('/api/commands', {type, payload: { ...payload, priceReason: 'Precio especial de prueba automática' }, requestId:`${prefix}-${suffix}`}, cookie);
try {
  await check('IT01', 'Sesión obligatoria y autenticación en Firebase Auth local', async () => {
    assert.equal((await api('/api/state')).status, 401);
    director = await login('administracion@chasquero.local');
    warehouse = await login('almacen@chasquero.local');
    assert.equal((await api('/api/me', null, director)).data.user.role, 'administrador');
  });
  await check('IT02', 'Permisos y ocultación de caja para almacén', async () => {
    const s = (await api('/api/state', null, warehouse)).data;
    assert.deepEqual(s.cash, []); assert.deepEqual(s.sales, []); assert.deepEqual(s.users, []);
    assert.equal((await cmd('cash.create', {date:'2026-09-14',direction:'ingreso',amount:'1',concept:'QA'}, 'forbidden',warehouse)).status,403);
    assert.equal((await api('/api/reports/cash',null,warehouse)).status,403);
  });
  await check('IT03', 'Firestore deniega lectura y escritura directa del cliente', async () => {
    const url=`http://127.0.0.1:${localConfig.firestorePort}/v1/projects/demo-chasquero-coffee/databases/(default)/documents/contacts`;
    assert.equal((await fetch(url)).status,403);
    assert.equal((await fetch(`${url}?documentId=${prefix}-blocked`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:{name:{stringValue:'QA'}}})})).status,403);
  });
  await check('IT04', 'Compra guardada con lote y egreso en la misma transacción', async () => {
    assert.equal((await cmd('contact.save',{name:'Contacto de prueba automática',type:'ambos',location:'Entorno local'},'contact')).status,200);
    const r=await cmd('purchase.create',{contactId:`${prefix}-contact`,quantity:'1',price:'10',paid:'4',date:'2026-09-14',stage:'coco',lotCode:prefix.toUpperCase()},'purchase');
    assert.equal(r.status,200);assert.equal(r.data.lots.find(x=>x.id===`${prefix}-purchase-lot`).stockGrams,1000);
    assert.equal(r.data.cash.find(x=>x.id===`${prefix}-purchase-cash`).signedCents,-400);
  });
  await check('IT05', 'Dos ventas simultáneas no permiten vender el mismo stock', async () => {
    const p={contactId:`${prefix}-contact`,lotId:`${prefix}-purchase-lot`,quantity:'1',price:'15',paid:'5',date:'2026-09-14'};
    const rs=await Promise.all([cmd('sale.create',p,'sale-a'),cmd('sale.create',p,'sale-b')]);
    assert.deepEqual(rs.map(r=>r.status).sort(),[200,400]);
    assert.equal((await readState()).lots.find(x=>x.id===`${prefix}-purchase-lot`).stockGrams,0);
  });
  await check('IT06', 'Reintento idéntico no duplica un abono; exceso rechazado', async () => {
    const sale=(await readState()).sales.find(x=>x.id.startsWith(prefix));
    const payload={sourceType:'sale',sourceId:sale.id,amount:'2',date:'2026-09-14',method:'efectivo'};
    assert.equal((await cmd('payment.create',payload,'payment')).status,200);
    assert.equal((await cmd('payment.create',payload,'payment')).status,200);
    assert.equal((await readState()).sales.find(x=>x.id===sale.id).paidCents,700);
    assert.equal((await cmd('payment.create',{...payload,amount:'9'},'overpay')).status,400);
  });
  await check('IT07', 'Anulación restaura stock y compensa cobros con historial', async () => {
    const s=await readState();const sale=s.sales.find(x=>x.id.startsWith(prefix));
    const r=await cmd('operation.void',{sourceType:'sale',sourceId:sale.id,date:'2026-09-14',reason:'Cierre del caso de prueba'},'void');
    assert.equal(r.status,200);assert.equal(r.data.lots.find(x=>x.id===`${prefix}-purchase-lot`).stockGrams,1000);
    assert.equal(r.data.cash.filter(x=>x.sourceId===sale.id).reduce((n,x)=>n+x.signedCents,0),0);
    assert.equal(r.data.sales.find(x=>x.id===sale.id).status,'anulado');
  });
  await check('IT08', 'CSV descargable respeta filtros y contiene datos persistidos', async () => {
    const r=await api(`/api/reports/purchases?from=2026-09-14&to=2026-09-14&q=${prefix}`,null,director);
    assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/attachment; filename=/);
    assert.match(r.data,/LOCAL DE PRUEBA/);assert.match(r.data,new RegExp(prefix));
    assert.equal(r.data.trim().split('\n').length,2);
  });
  await check('IT09', 'Creación y reintento de un acceso sin duplicar Firebase Auth', async () => {
    const body={requestId:`${prefix}-user`,payload:{name:'Usuario de prueba automática',email:`${prefix}@chasquero.local`,password:'PruebaLocal2026!',role:'trabajador',area:'almacen',active:true}};
    const r=await api('/api/users',body,director);assert.equal(r.status,200,JSON.stringify(r.data));
    createdUser=r.data.users.find(x=>x.email===body.payload.email).id;
    assert.equal((await api('/api/users',body,director)).status,200);
    assert.equal((await readState()).users.filter(x=>x.email===body.payload.email).length,1);
  });
  await check('IT10', 'Acceso desactivado no ingresa; el correo no se cambia por API', async () => {
    const u=(await readState()).users.find(x=>x.id===createdUser);
    assert.equal((await api('/api/users',{requestId:`prefix-${prefix}-email`,payload:{...u,email:'otro@chasquero.local'}},director)).status,400);
    assert.equal((await api('/api/users',{requestId:`${prefix}-disable`,payload:{...u,active:false}},director)).status,200);
    assert.equal((await api('/api/login',{email:u.email,password:'PruebaLocal2026!'})).status,403);
  });
  await check('IT11', 'Mutaciones requieren la cabecera del cliente local', async () => {
    const r=await fetch(base+'/api/commands',{method:'POST',headers:{'Content-Type':'application/json',Cookie:director},body:'{}'});
    assert.equal(r.status,403);
  });
  await check('IT12', 'Lecturas sucesivas conservan datos y auditoría de la operación', async () => {
    const a=(await api('/api/state',null,director)).data;const b=(await api('/api/state',null,director)).data;
    assert.deepEqual(a.purchases,b.purchases);assert.ok(a.audit.some(x=>x.id===`${prefix}-purchase`));
  });
  await check('IT13', 'Liquidación de pergamino descarta decimales y paga 862 soles sin alterar 50 kg', async () => {
    const payload={contactId:`${prefix}-contact`,stage:'pergamino',quality:80,quantity:'50',moisture:'15',moistureDivisor:'56.5',price:'980',paid:'862',date:'2026-09-14',lotCode:`${prefix}-liq`,totalCents:999999999};
    const r=await cmd('purchase.create',payload,'settlement');
    assert.equal(r.status,200,JSON.stringify(r.data));
    const operation=r.data.purchases.find(x=>x.id===`${prefix}-settlement`);
    assert.equal(operation.totalCents,86200);assert.equal(operation.settlementUnits,'0.88');assert.equal(operation.calculatedCents,86240);
    assert.equal(r.data.lots.find(x=>x.id===`${prefix}-settlement-lot`).stockGrams,50000);
    assert.equal(r.data.cash.find(x=>x.sourceId===operation.id).signedCents,-86200);
    assert.equal((await cmd('purchase.create',{...payload,paid:'862.40',lotCode:`${prefix}-bad`},'invalid-settlement')).status,400);
  });
} finally {
  // Remove only records created by this run; never alter existing business records.
  const after=await readState();const batch=db.batch();
  for(const c of COLLECTIONS) {const oldIds=new Set(before[c].map(x=>x.id));for(const x of after[c])if(!oldIds.has(x.id)&&(x.id.startsWith(prefix)||x.id===createdUser))batch.delete(db.doc(`${c}/${x.id}`));}
  await batch.commit();if(createdUser)await auth.deleteUser(createdUser);
  await writeFile('tests/integration-results.json',JSON.stringify({environment:'Firebase Auth y Firestore Emulator',executedAt:new Date().toISOString(),results},null,2));
  await db.terminate();
}
