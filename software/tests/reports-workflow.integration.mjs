import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {writeFile,mkdir} from 'node:fs/promises';
import {localConfig} from '../server/local-config.mjs';import {readState,db} from '../server/firebase.mjs';import {COLLECTIONS} from '../server/domain.mjs';
const base=`http://127.0.0.1:${localConfig.apiPort}`,prefix='report-qa-'+randomUUID().slice(0,8),results=[];
const before=await readState();
async function request(path,cookie='',body){const r=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Chasquero-Client':'local-app',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});return r;}
async function login(email,portal){const r=await request('/login','',{email,portal,password:'CafeLocal2026!'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
async function check(name,fn){await fn();results.push({name,status:'APROBADA'});console.log('APROBADA: '+name);}
async function cmd(type,payload,suffix,cookie){const r=await request('/commands',cookie,{type,payload,requestId:prefix+'-'+suffix});return {status:r.status,data:await r.json()};}
const sampleDir=process.env.CHASQUERO_QA_DIR;
try{
 const admin=await login('administracion@chasquero.local','administrador'),manager=await login('director@chasquero.local','gerente'),warehouse=await login('almacen@chasquero.local','trabajador'),cashier=await login('caja@chasquero.local','trabajador');
 await check('Los cuatro perfiles descargan precios PDF y CSV autorizados',async()=>{
   for(const cookie of [admin,manager,warehouse,cashier]){
     const pdf=await request('/reports/prices?format=pdf&stage=pergamino',cookie);assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),/application\/pdf/);assert.match(pdf.headers.get('content-disposition'),/\.pdf/);
     const bytes=Buffer.from(await pdf.arrayBuffer());assert.ok(bytes.subarray(0,5).equals(Buffer.from('%PDF-')));
     const csv=await request('/reports/prices?format=csv',cookie);assert.equal(csv.status,200);const text=await csv.text();if(cookie===warehouse)assert.ok(!text.includes('"venta"'));if(cookie===cashier)assert.ok(!text.includes('"compra"'));
     if(sampleDir&&cookie===admin){await mkdir(sampleDir,{recursive:true});await writeFile(sampleDir+'/precios.pdf',bytes);}
   }
 });
 await check('PDF disponible para todos los reportes y estadísticas del administrador',async()=>{
   for(const kind of ['purchases','sales','inventory','cash','processes','summary','audit','statistics','monthly','partners','quality','balances','returns','stock-alerts']){
     const r=await request('/reports/'+kind+'?format=pdf&from=2026-01-01&to=2026-12-31',admin);assert.equal(r.status,200,kind);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.subarray(0,5).toString(),'%PDF-',kind);
     if(sampleDir&&['purchases','statistics'].includes(kind))await writeFile(sampleDir+'/'+kind+'.pdf',b);
   }
 });
 await check('Permisos y filtros PDF: almacén no exporta caja ni auditoría',async()=>{
   for(const kind of ['sales','cash','summary','audit','monthly','balances'])assert.equal((await request('/reports/'+kind+'?format=pdf',warehouse)).status,403,kind);
   assert.equal((await request('/reports/prices?format=exe',admin)).status,400);
   const r=await request('/reports/prices?format=csv&stage=pergamino&quality=79&active=true',admin);assert.equal(r.status,200);assert.ok(!(await r.text()).includes('"70"'));
 });
 let purchaseId,saleId,lotId;
 await check('Compra pendiente se recibe en almacén; no hay stock antes de la recepción',async()=>{
   let r=await cmd('contact.save',{name:'Contacto QA '+prefix,type:'ambos'},'contact',admin);assert.equal(r.status,200);
   r=await cmd('purchase.create',{contactId:prefix+'-contact',stage:'coco',quantity:'4',price:'10',paid:'0',priceReason:'Prueba de recepción pendiente',deliveryStatus:'pendiente',date:'2026-10-13',lotCode:prefix},'purchase',admin);assert.equal(r.status,200,JSON.stringify(r.data));purchaseId=prefix+'-purchase';lotId=purchaseId+'-lot';assert.equal(r.data.lots.find(x=>x.id===lotId).stockGrams,0);
   r=await cmd('purchase.receive',{id:purchaseId,date:'2026-10-13'},'receive',warehouse);assert.equal(r.status,200);assert.equal(r.data.lots.find(x=>x.id===lotId).stockGrams,4000);
 });
 await check('Venta pendiente reserva stock; entregar y devolver compensa una sola vez',async()=>{
   let r=await cmd('sale.create',{contactId:prefix+'-contact',lotId,quantity:'2',price:'20',paid:'0',priceReason:'Prueba de entrega pendiente',deliveryStatus:'pendiente',date:'2026-10-13'},'sale',admin);assert.equal(r.status,200,JSON.stringify(r.data));saleId=prefix+'-sale';assert.equal(r.data.lots.find(x=>x.id===lotId).stockGrams,4000);assert.equal(r.data.lots.find(x=>x.id===lotId).reservedGrams,2000);
   r=await cmd('sale.deliver',{id:saleId,date:'2026-10-13'},'deliver',cashier);assert.equal(r.status,200);assert.equal(r.data.lots.find(x=>x.id===lotId).stockGrams,2000);
   r=await cmd('operation.return',{sourceType:'sale',sourceId:saleId,date:'2026-10-13',reason:'Devolución QA completa'},'return-sale',admin);assert.equal(r.status,200);assert.equal(r.data.lots.find(x=>x.id===lotId).stockGrams,4000);assert.equal(r.data.sales.find(x=>x.id===saleId).status,'devuelto');
   r=await cmd('operation.void',{sourceType:'sale',sourceId:saleId,date:'2026-10-13',reason:'Anulación posterior a devolución QA'},'void-sale',admin);assert.equal(r.status,200);assert.equal(r.data.lots.find(x=>x.id===lotId).stockGrams,4000);
 });
 await check('Filtros distinguen estado pendiente/devuelto y la compra devuelta puede anularse',async()=>{
   let r=await cmd('operation.return',{sourceType:'purchase',sourceId:purchaseId,date:'2026-10-13',reason:'Devolución QA al productor'},'return-purchase',admin);assert.equal(r.status,200);assert.equal(r.data.lots.find(x=>x.id===lotId).stockGrams,0);
   const csv=await request('/reports/purchases?format=csv&status=devuelto&q='+prefix,admin);const text=await csv.text();assert.ok(text.includes('"devuelto"'));assert.equal(text.trim().split('\n').length,2);
   const pending=await request('/reports/purchases?format=csv&status=pendiente&q='+prefix,admin);assert.equal((await pending.text()).trim().split('\n').length,1);
   r=await cmd('operation.void',{sourceType:'purchase',sourceId:purchaseId,date:'2026-10-13',reason:'Anulación administrativa QA'},'void-purchase',admin);assert.equal(r.status,200);assert.equal(r.data.lots.find(x=>x.id===lotId).stockGrams,0);
 });
}finally{
 const after=await readState(),batch=db.batch();for(const c of COLLECTIONS){const ids=new Set(before[c].map(x=>x.id));for(const item of after[c])if(!ids.has(item.id)&&item.id.startsWith(prefix))batch.delete(db.doc(c+'/'+item.id));}await batch.commit();
 await writeFile('tests/reports-workflow-results.json',JSON.stringify({environment:'Emuladores locales',results},null,2));await db.terminate();
}
