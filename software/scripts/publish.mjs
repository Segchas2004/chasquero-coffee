import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
function run(script,args=[]){
 const result=spawnSync(process.execPath,[script,...args],{cwd:root,stdio:'inherit',windowsHide:true});
 if(result.error||result.status!==0){console.error('La publicación se detuvo. Revisa el resultado anterior; no se confirma una publicación incompleta.');process.exit(result.status||1);}
}
run('scripts/check-firebase.mjs');
run('scripts/prepare-firebase.mjs');
run('node_modules/typescript/bin/tsc',['--noEmit']);
run('node_modules/vite/bin/vite.js',['build']);
const cli='node_modules/firebase-tools/lib/bin/firebase.js';
const project=JSON.parse(fs.readFileSync('.firebaserc','utf8')).projects.default;
run(cli,['deploy','--project',project,'--only','functions,firestore','--non-interactive']);
run(cli,['deploy','--project',project,'--only','hosting','--non-interactive']);
run('scripts/cloud-smoke.mjs',[`https://${project}.web.app/`]);
console.log(`Publicado y comprobaciones iniciales aprobadas: https://${project}.web.app/`);
console.log('Antes de compras o ventas reales, completa la revisión por perfiles y confirma el tarifario de negocio.');
