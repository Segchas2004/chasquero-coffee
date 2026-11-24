import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { networkLinks } from './network.mjs';
import { launchState } from './launch-state.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const noBrowser=process.argv.includes('--no-browser');
let child;
function currentState(){
  let lock,runtime;
  try{lock=JSON.parse(readFileSync(path.join(root,'.local-running.json'),'utf8'));}catch{}
  try{runtime=JSON.parse(readFileSync(path.join(root,'.local-runtime.json'),'utf8'));}catch{}
  let alive=false;
  if(Number.isInteger(lock?.pid)&&lock.pid>0){try{process.kill(lock.pid,0);alive=true;}catch{}}
  return launchState(lock,runtime,alive);
}
async function healthy(port){
  try{const r=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(1500)});return r.ok&&(await r.json()).mode==='firebase-emulators';}catch{return false;}
}
async function firewall(port){
  if(process.platform!=='win32')return;
  console.log('\nComprobando el acceso de Windows para los otros equipos...');
  const command=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/permitir-red-local.ps1'),'-Port',String(port),'-NodePath',process.execPath],{cwd:root,stdio:'inherit',windowsHide:true});
  const code=await new Promise((resolve,reject)=>{command.once('error',reject);command.once('exit',resolve);});
  if(code!==0)console.log('El sistema esta abierto. Para permitir otras laptops, ejecuta PERMITIR_RED_LOCAL_ADMIN.cmd y acepta el aviso de Windows.');
}
function openBrowser(url){
  if(noBrowser)return;
  if(process.platform==='win32'){
    const browser=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore',windowsHide:true});
    browser.once('error',()=>console.log('Abre el enlace anterior en tu navegador.'));browser.unref();
  }
}
async function main(){
  console.log('CHASQUERO COFFEE\nInicio del sistema y acceso desde el mismo Wi-Fi.');
  let state=currentState();
  if(state.status==='local')throw new Error('Hay una sesion iniciada solo para esta laptop. Cierrala con Ctrl+C, espera que guarde y vuelve a abrir este archivo.');
  if(state.status==='invalid')throw new Error('La configuracion no coincide con el sistema abierto. Cierra su iniciador con Ctrl+C y vuelve a intentar.');
  if(state.status==='down'){
    if(!networkLinks(5173).length)throw new Error('Conecta esta laptop al Wi-Fi antes de iniciar.');
    console.log('\nIniciando la base de datos, la API y la pagina web...');
    child=spawn(process.execPath,[path.join(root,'scripts/dev.mjs'),'--lan'],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,CI:'true',FIREBASE_CLI_DISABLE_USAGE:'true'}});
    child.once('error',error=>{console.error(error.message);process.exitCode=1;});
  }else console.log('\nEl sistema ya esta abierto. Conservamos la sesion y los datos.');
  const deadline=Date.now()+240000;
  while(Date.now()<deadline){
    state=currentState();
    if(state.status==='ready'&&await healthy(state.port))break;
    if(child&&child.exitCode!==null)throw new Error('No se pudo completar el inicio. Revisa el mensaje anterior.');
    await new Promise(resolve=>setTimeout(resolve,600));
  }
  if(state.status!=='ready'||!await healthy(state.port))throw new Error('El sistema no respondio a tiempo. Revisa la ventana del iniciador.');
  await firewall(state.port);
  const links=networkLinks(state.port);
  if(!links.length)throw new Error('La conexion Wi-Fi cambio. Vuelve a conectarte y abre VER_ENLACE_RED.cmd.');
  const guide=['CHASQUERO COFFEE - ENLACE PARA COMPARTIR','',...links.map(link=>`${link.name}: ${link.url}`),'','Los otros equipos deben estar conectados al mismo Wi-Fi.','Cada persona ingresa con su cuenta y su perfil.','Mantener esta laptop encendida y el sistema en ejecucion.','Si cambias de Wi-Fi, vuelve a abrir ABRIR_CHASQUERO.cmd.'];
  writeFileSync(path.join(root,'ENLACE_RED_LOCAL.txt'),guide.join('\r\n'),'utf8');
  console.log('\nSISTEMA LISTO\n');
  for(const link of links)console.log(`Enlace para compartir (${link.name}): ${link.url}`);
  console.log('\nEl enlace tambien esta guardado en ENLACE_RED_LOCAL.txt.');
  if(child)console.log('Mantener abierta esta ventana. Al terminar, presiona Ctrl+C y espera a que guarde.');
  else console.log('Este archivo encontro el sistema ya encendido. Puedes cerrar esta ventana; conserva abierto su iniciador original.');
  openBrowser(links[0].url);
  if(child)await new Promise(resolve=>child.once('exit',resolve));
}
// The console sends Ctrl+C to the service launcher as well. Let it save before this wrapper exits.
process.on('SIGINT',()=>{if(child)console.log('\nEsperando el cierre del sistema y el guardado de datos...');else process.exit(0);});
main().catch(error=>{console.error('\n'+error.message);process.exitCode=1;});
