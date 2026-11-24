import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {getProjectDefaultAccount,getGlobalDefaultAccount}=require('firebase-tools/lib/auth');
const {requireAuth}=require('firebase-tools/lib/requireAuth');
const {Client}=require('firebase-tools/lib/apiv2');
const project=JSON.parse(await fs.readFile(new URL('../.firebaserc',import.meta.url),'utf8')).projects.default;
const account=getProjectDefaultAccount(project)||getGlobalDefaultAccount();
if(!account)throw new Error('Inicia sesión con Firebase CLI antes de comprobar el proyecto.');
await requireAuth({...account,project,nonInteractive:true});
// Read billing status only. Never link an account, enable billing or deploy.
const client=new Client({urlPrefix:'https://cloudbilling.googleapis.com',apiVersion:'v1'});
const response=await client.get(`/projects/${project}/billingInfo`);
const billingEnabled=response.body.billingEnabled===true;
const result={checkedAt:new Date().toISOString(),project,billingEnabled,canDeployFunctions:billingEnabled,site:`https://${project}.web.app`,changesMade:false};
const folder=new URL('../documentacion/Sprint_05/Evidencias/',import.meta.url);await fs.mkdir(folder,{recursive:true});await fs.writeFile(new URL('Preparacion_Firebase.json',folder),JSON.stringify(result,null,2));
console.log(`Proyecto: ${project}. Functions: ${billingEnabled?'facturación habilitada; falta validar el despliegue':'requiere habilitar Blaze por el propietario'}.`);
if(!billingEnabled)process.exitCode=2;
