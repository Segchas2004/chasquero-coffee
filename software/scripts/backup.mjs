import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { localConfig } from '../server/local-config.mjs';
import { checkedBackupPaths, newBackupDirectory, validBackup } from './backup-io.mjs';
// Independent snapshots avoid moving folders retained by the Windows emulator.
// Metadata is written last; incomplete snapshots are ignored on restart.
export async function backup(destination = '.emulator-data') {
 const root=fileURLToPath(new URL('../',import.meta.url));
 const {target}=checkedBackupPaths(root,destination),snapshot=newBackupDirectory(target);
 await mkdir(snapshot,{recursive:true});
 async function request(port,route,body){
  const r=await fetch(`http://127.0.0.1:${port}${route}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw new Error(`Exportación local: HTTP ${r.status}`);return r.json();
 }
 await request(localConfig.firestorePort,'/emulator/v1/projects/demo-chasquero-coffee:export',{database:'projects/demo-chasquero-coffee/databases/(default)',export_directory:snapshot,export_name:'firestore_export'});
 const authDir=path.join(snapshot,'auth_export');await mkdir(authDir);
 const accounts=await request(localConfig.authPort,'/identitytoolkit.googleapis.com/v1/projects/demo-chasquero-coffee/accounts:batchGet?maxResults=-1');
 const config=await request(localConfig.authPort,'/emulator/v1/projects/demo-chasquero-coffee/config');
 await writeFile(path.join(authDir,'accounts.json'),JSON.stringify(accounts));await writeFile(path.join(authDir,'config.json'),JSON.stringify(config));
 const version=JSON.parse(await readFile(path.join(root,'node_modules/firebase-tools/package.json'),'utf8')).version;
 await writeFile(path.join(snapshot,'firebase-export-metadata.json'),JSON.stringify({version,firestore:{version:'1.22.0',path:'firestore_export',metadata_file:'firestore_export/firestore_export.overall_export_metadata'},auth:{version,path:'auth_export'}},null,2));
 if(!validBackup(snapshot))throw new Error('La exportación no superó la validación. Se conserva la copia anterior.');
 console.log('Copia local completada en '+snapshot+'. Conserva toda la carpeta de copias.');return snapshot;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)backup().catch(e=>{console.error(e.message);process.exitCode=1;});
