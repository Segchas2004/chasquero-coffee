import {localConfig} from '../server/local-config.mjs';
import {networkLinks} from './network.mjs';
let found=false;
for(const link of networkLinks(localConfig.webPort)){
 try{
  const response=await fetch(link.health,{signal:AbortSignal.timeout(2000)});
  const result=response.ok?await response.json():null;
  if(result?.ok&&result.mode==='firebase-emulators'){console.log(`Enlace para compartir (${link.name}): ${link.url}`);found=true;}
 }catch{}
}
if(!found)console.log('No se encontro un acceso de red activo. Inicia INICIAR_RED_LOCAL.cmd y vuelve a ejecutar este archivo.');
console.log('Todos deben estar en el mismo Wi-Fi. La laptop y la ventana del iniciador deben seguir encendidas.');
console.log('Si otra laptop no conecta, ejecuta PERMITIR_RED_LOCAL_ADMIN.cmd y acepta el aviso de Windows.');
