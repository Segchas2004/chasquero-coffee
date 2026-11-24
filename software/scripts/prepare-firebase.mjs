import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const project=JSON.parse(fs.readFileSync(new URL('../.firebaserc',import.meta.url),'utf8')).projects.default;
let apiKey=process.env.FIREBASE_WEB_API_KEY;
const configFile=new URL('../firebase-web-config.json',import.meta.url);
if(!apiKey && fs.existsSync(configFile)){
  const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
  if(config.projectId!==project || !config.apiKey)throw new Error('La configuración web no coincide con el proyecto seleccionado.');
  apiKey=config.apiKey;
}
// Retrieve public web configuration through the user's existing Firebase CLI session.
// Neither credentials nor API configuration need to be committed to Git.
if(!apiKey){
  const cli=fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js',import.meta.url));
  const run=args=>{
    let output;
    try{output=execFileSync(process.execPath,[cli,...args,'--project',project,'--json'],{encoding:'utf8',stdio:['ignore','pipe','inherit']});}
    catch(error){
      // Some Windows CLI versions exit after already returning a completed read.
      try{const completed=JSON.parse(String(error.stdout));if(completed.status==='success')return completed;}catch{}
      throw new Error('No se pudo leer la configuración de Firebase. Comprueba tu sesión y los permisos del proyecto.');
    }
    const result=JSON.parse(output);
    if(result.status!=='success')throw new Error('Firebase no devolvió una configuración válida.');
    return result;
  };
  const listed=run(['apps:list','web']);
  const apps=Array.isArray(listed.result)?listed.result:listed.result?.apps;
  if(!apps?.length)throw new Error('Falta registrar una app web en el proyecto de Firebase.');
  const configured=run(['apps:sdkconfig','web',apps[0].appId]);
  apiKey=configured.result?.sdkConfig?.apiKey;
  if(!apiKey)throw new Error('No se pudo recuperar la configuración web. Inicia sesión en Firebase CLI y revisa el proyecto.');
}
if(!/^[A-Za-z0-9_-]+$/.test(apiKey))throw new Error('La configuración de Authentication no es válida.');
fs.writeFileSync(new URL('../.env.'+project,import.meta.url),'FIREBASE_WEB_API_KEY='+apiKey+'\n');
console.log('Parámetro de Authentication preparado para Functions.');
