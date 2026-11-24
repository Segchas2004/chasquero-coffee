import path from 'node:path';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
export function checkedBackupPaths(root,destination){
 const target=path.resolve(root,destination),relative=path.relative(path.resolve(root),target);
 if(!relative||relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))throw new Error('La copia debe guardarse en una subcarpeta del proyecto.');
 return {target,snapshots:target+'-snapshots'};
}
export function newBackupDirectory(target){return path.join(target+'-snapshots',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());}
function inside(root,relative){
 if(typeof relative!=='string')return null;
 const result=path.resolve(root,relative),rel=path.relative(root,result);
 return rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)?result:null;
}
export function validBackup(folder){
 try{
  const meta=JSON.parse(readFileSync(path.join(folder,'firebase-export-metadata.json'),'utf8'));
  const firestore=inside(folder,meta.firestore?.metadata_file),auth=inside(folder,meta.auth?.path);
  if(!firestore||!auth||statSync(firestore).size===0)return false;
  const accounts=JSON.parse(readFileSync(path.join(auth,'accounts.json'),'utf8'));JSON.parse(readFileSync(path.join(auth,'config.json'),'utf8'));
  return Array.isArray(accounts.users);
 }catch{return false;}
}
export function findLocalBackup(target){
 const snapshotRoot=target+'-snapshots';
 const snapshots=existsSync(snapshotRoot)?readdirSync(snapshotRoot,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>path.join(snapshotRoot,x.name)):[];
 const candidates=[...snapshots,target,target+'.previous'].filter(validBackup);
 candidates.sort((a,b)=>statSync(path.join(b,'firebase-export-metadata.json')).mtimeMs-statSync(path.join(a,'firebase-export-metadata.json')).mtimeMs);
 return candidates[0]||null;
}
