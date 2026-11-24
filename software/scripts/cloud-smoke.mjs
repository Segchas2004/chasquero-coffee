import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const target=process.argv[2];
if(!target)throw new Error('Indica el enlace HTTPS publicado del sistema.');
const base=new URL(target);
if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('Utiliza solo la dirección HTTPS principal del sitio publicado.');
const results=[];
async function check(name,fn){await fn();results.push({name,status:'APROBADA'});console.log('APROBADA: '+name);}
async function publishedResponse(url){
 const deadline=Date.now()+90000;let lastError;
 do{
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
   if(![404,502,503,504].includes(response.status))return response;
   lastError=new Error(`La publicación todavía responde HTTP ${response.status}.`);
   await response.body?.cancel();
  }catch(error){lastError=error;}
  if(Date.now()>=deadline)throw lastError;
  await new Promise(resolve=>setTimeout(resolve,1000));
 }while(Date.now()<deadline);
 throw lastError;
}
try{
 await check('El sitio entrega la web compilada',async()=>{const r=await publishedResponse(base);assert.equal(r.status,200);assert.match(await r.text(),/Chasquero Coffee/);});
 await check('La API publicada utiliza Firebase real',async()=>{const r=await publishedResponse(new URL('/api/health',base));assert.equal(r.status,200);assert.equal((await r.json()).mode,'firebase-cloud');assert.equal(r.headers.get('cache-control'),'no-store');});
 await check('Los datos y los reportes exigen una sesión',async()=>{for(const path of ['/api/state','/api/reports/cash?format=pdf']){const r=await fetch(new URL(path,base));assert.equal(r.status,401);}});
 await check('La API rechaza escrituras desde otro origen',async()=>{const r=await fetch(new URL('/api/commands',base),{method:'POST',headers:{Origin:'https://invalid.example','X-Chasquero-Client':'local-app','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);});
}finally{
 const folder=new URL('../documentacion/Sprint_05/Evidencias/',import.meta.url);await mkdir(folder,{recursive:true});
 await writeFile(new URL('Publicacion.json',folder),JSON.stringify({executedAt:new Date().toISOString(),site:base.origin,results},null,2));
}
