import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { db, production, projectId } from '../server/firebase.mjs';
import { COLLECTIONS } from '../server/domain.mjs';
import { pendingOperations } from '../src/workflow.mjs';
import { localConfig } from '../server/local-config.mjs';

assert.equal(production, false, 'Solo se permite ejecutar esta prueba con emuladores.');
assert.equal(projectId, 'demo-chasquero-coffee');
const base = `http://127.0.0.1:${localConfig.apiPort}`, prefix = `s4-${randomUUID().slice(0,8)}`;
const results = []; let cookie = '', warehouse = '', purchaseId, saleId, contactId;
async function api(path, body, session = cookie) {
  const r = await fetch(base + '/api' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type':'application/json', 'X-Chasquero-Client':'local-app', Cookie:session }, ...(body ? {body:JSON.stringify(body)} : {}) });
  const bytes = Buffer.from(await r.arrayBuffer());
  return { status:r.status, headers:r.headers, bytes, data:r.headers.get('content-type')?.includes('json') ? JSON.parse(bytes.toString()) : bytes.toString() };
}
const cmd = (type,payload,suffix,session=cookie) => api('/commands',{type,payload,requestId:`${prefix}-${suffix}`},session);
const state = async () => (await api('/state')).data;
async function check(id,name,fn) {
  try { await fn(); results.push({id,name,status:'APROBADA'}); console.log(`${id} APROBADA: ${name}`); }
  catch(e) { results.push({id,name,status:'FALLIDA',error:e.message}); throw e; }
}
const date = '2026-11-23';
try {
  for (const [email,assign] of [['administracion@chasquero.local',c=>cookie=c],['almacen@chasquero.local',c=>warehouse=c]]) {
    const login = await api('/login',{email,password:'CafeLocal2026!'},''); assert.equal(login.status,200); assign(login.headers.get('set-cookie').split(';')[0]);
  }
  await check('S4-I01','Compra, cuenta por pagar y egreso se guardan juntos',async()=>{
    let r=await cmd('contact.save',{name:'Contraparte prueba Sprint 4',type:'ambos',location:prefix},'contact');assert.equal(r.status,200);contactId=`${prefix}-contact`;
    r=await cmd('purchase.create',{contactId,date,stage:'coco',quantity:'10',price:'10',paid:'20',lotCode:prefix.toUpperCase(),priceReason:'Tarifa ficticia para prueba aislada'},'purchase');
    assert.equal(r.status,200);purchaseId=`${prefix}-purchase`;
    assert.equal(r.data.lots.find(x=>x.id===purchaseId+'-lot').stockGrams,10000);
    assert.equal(r.data.cash.find(x=>x.sourceId===purchaseId).signedCents,-2000);
  });
  await check('S4-I02','Dos ventas simultáneas no sobrepasan las existencias',async()=>{
    const payload={contactId,date,lotId:purchaseId+'-lot',quantity:'10',price:'20',paid:'10',priceReason:'Tarifa ficticia para concurrencia'};
    const rs=await Promise.all([cmd('sale.create',payload,'sale-a'),cmd('sale.create',payload,'sale-b')]);
    assert.deepEqual(rs.map(x=>x.status).sort(),[200,400]);
    const s=await state();saleId=s.sales.find(x=>x.id.startsWith(prefix)).id;assert.equal(s.lots.find(x=>x.id===purchaseId+'-lot').stockGrams,0);
    assert.equal(s.sales.filter(x=>x.id.startsWith(prefix)).length,1);
  });
  await check('S4-I03','Dos reintentos simultáneos de un abono generan un solo ingreso',async()=>{
    const p={sourceType:'sale',sourceId:saleId,date,amount:'40',method:'yape'};
    const rs=await Promise.all([cmd('payment.create',p,'payment-once'),cmd('payment.create',p,'payment-once')]);
    rs.forEach(r=>assert.equal(r.status,200));const s=await state();
    assert.equal(s.sales.find(x=>x.id===saleId).paidCents,5000);
    assert.equal(s.cash.filter(x=>x.id===prefix+'-payment-once-cash').length,1);
  });
  await check('S4-I04','Abonos excesivos, cero y negativos no alteran saldo ni caja',async()=>{
    const before=await state();
    for(const [i,amount] of ['151','0','-1'].entries())assert.equal((await cmd('payment.create',{sourceType:'sale',sourceId:saleId,date,amount},'invalid-payment-'+i)).status,400);
    const after=await state();assert.deepEqual(after.sales,before.sales);assert.deepEqual(after.cash,before.cash);
  });
  await check('S4-I05','Caja manual filtra fecha y medio y exporta PDF',async()=>{
    assert.equal((await cmd('cash.create',{direction:'ingreso',date,amount:'100',concept:prefix+' aporte',method:'yape'},'cash-income')).status,200);
    assert.equal((await cmd('cash.create',{direction:'egreso',date,amount:'25',concept:prefix+' gasto',method:'efectivo'},'cash-expense')).status,200);
    for(const [i,amount] of ['0','-1'].entries())assert.equal((await cmd('cash.create',{direction:'ingreso',date,amount,concept:prefix},'bad-cash-'+i)).status,400);
    const r=await api(`/reports/cash?format=csv&from=${date}&to=${date}&method=yape&q=${prefix}`);assert.equal(r.status,200);assert.ok(r.data.includes(prefix+' aporte'));assert.ok(!r.data.includes(prefix+' gasto'));
    const pdf=await api(`/reports/cash?format=pdf&from=${date}&to=${date}&method=yape&q=${prefix}`);assert.equal(pdf.status,200);assert.equal(pdf.bytes.subarray(0,5).toString(),'%PDF-');
  });
  await check('S4-I06','Anular exige motivo y restaura stock y cobros una sola vez',async()=>{
    const p={sourceType:'sale',sourceId:saleId,date,reason:''};assert.equal((await cmd('operation.void',p,'void-sale')).status,400);
    const body={...p,reason:'Corrección comprobada del caso de prueba'};
    let r=await cmd('operation.void',body,'void-sale');assert.equal(r.status,200);
    assert.equal(r.data.lots.find(x=>x.id===purchaseId+'-lot').stockGrams,10000);
    assert.equal(r.data.cash.filter(x=>x.sourceId===saleId).reduce((n,x)=>n+x.signedCents,0),0);
    const count=r.data.cash.length;r=await cmd('operation.void',body,'void-sale');assert.equal(r.status,200);assert.equal(r.data.cash.length,count);
    assert.equal((await cmd('operation.void',body,'void-sale-again')).status,400);
  });
  await check('S4-I07','No se anula una compra cuyo lote tiene salidas',async()=>{
    const r=await cmd('sale.create',{contactId,date,lotId:purchaseId+'-lot',quantity:'1',price:'20',paid:'5',priceReason:'Tarifa ficticia de prueba'},'sale-return');assert.equal(r.status,200);
    assert.equal((await cmd('operation.void',{sourceType:'purchase',sourceId:purchaseId,date,reason:'Intento con salida posterior'},'blocked-void')).status,400);
  });
  await check('S4-I08','Una venta devuelta desaparece de pendientes y reportes de deuda',async()=>{
    const sourceId=prefix+'-sale-return';let r=await cmd('operation.return',{sourceType:'sale',sourceId,date,reason:'Devolución completa confirmada',refundConfirmed:'yes'},'return-sale');assert.equal(r.status,200);
    assert.ok(!pendingOperations(r.data.sales).some(x=>x.id===sourceId));
    const report=await api(`/reports/balances?format=csv&from=${date}&to=${date}&q=${prefix}`);assert.equal(report.status,200);assert.ok(!report.data.includes('Por cobrar'));
    assert.equal((await cmd('payment.create',{sourceType:'sale',sourceId,date,amount:'1'},'returned-payment')).status,400);
  });
  await check('S4-I09','Devolver compra cancela la deuda y compensa el pago sin borrar historia',async()=>{
    const r=await cmd('operation.return',{sourceType:'purchase',sourceId:purchaseId,date,reason:'Devolución completa al productor',refundConfirmed:'yes'},'return-purchase');assert.equal(r.status,200);
    assert.ok(!pendingOperations(r.data.purchases).some(x=>x.id===purchaseId));
    assert.equal(r.data.purchases.find(x=>x.id===purchaseId).status,'devuelto');
    assert.equal(r.data.cash.filter(x=>x.sourceId===purchaseId).reduce((n,x)=>n+x.signedCents,0),0);
    const report=await api(`/reports/balances?format=csv&from=${date}&to=${date}&q=${prefix}`);assert.ok(!report.data.includes('Por pagar'));
  });
  await check('S4-I10','Almacén no puede registrar caja ni anular operaciones',async()=>{
    assert.equal((await cmd('cash.create',{direction:'ingreso',date,amount:'1',concept:'Sin permiso'},'denied-cash',warehouse)).status,403);
    assert.equal((await cmd('operation.void',{sourceType:'purchase',sourceId:purchaseId,date,reason:'Sin permiso'},'denied-void',warehouse)).status,403);
  });
} finally {
  const batch=db.batch();for(const name of COLLECTIONS){const snap=await db.collection(name).get();for(const doc of snap.docs)if(doc.id.startsWith(prefix))batch.delete(doc.ref);}await batch.commit();
  const folder=new URL('../documentacion/Sprint_04/Evidencias/',import.meta.url);await mkdir(folder,{recursive:true});
  await writeFile(new URL('Integracion.json',folder),JSON.stringify({executedAt:new Date().toISOString(),environment:'Emuladores Firebase',apiPort:localConfig.apiPort,firestorePort:localConfig.firestorePort,results},null,2));
  await db.terminate();
}
