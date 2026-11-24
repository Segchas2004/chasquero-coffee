import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { networkLinks } from './network.mjs';
import { findLocalBackup } from './backup-io.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = []; let closing = false; let terminateClient; let dataReady=false;
const lockPath = path.join(root, '.local-running.json');
const value = (key, fallback) => { const i = process.argv.indexOf(key); return i >= 0 ? process.argv[i + 1] : fallback; };
const lan = process.argv.includes('--lan');
const host = value('--host', lan ? '0.0.0.0' : '127.0.0.1');
const reserved = new Set();
async function freePort(start) {
  for (let port = Number(start); port < Number(start) + 100; port++) {
    if (reserved.has(port)) continue;
    const available = await new Promise(resolve => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (available) { reserved.add(port); return port; }
  }
  throw new Error(`No hay un puerto disponible cerca de ${start}. Cierra las instancias antiguas del proyecto.`);
}
function launch(script, args = []) {
  const child = spawn(process.execPath, [path.join(root, script), ...args], { cwd: root, stdio: 'inherit', env: process.env, detached:process.platform==='win32', windowsHide:true });
  children.push(child);
  child.on('error', error => { console.error(error.message); process.exitCode = 1; shutdown(); });
  child.on('exit', code => { if (!closing) { console.error(`Un servicio se detuvo (cÃ³digo ${code}). Revisa el mensaje anterior.`); process.exitCode = 1; shutdown(); } });
  return child;
}
function stopChild(child){
  if(child.exitCode!==null)return;
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  else child.kill('SIGINT');
}
async function shutdown() {
  if(closing)return;closing=true;
  console.log('\nCerrando el acceso y guardando Firebase local. Espera a que termine...');
  for(const child of children.slice(1).reverse())stopChild(child);
  if(dataReady){
    try{const {backup}=await import('./backup.mjs');await backup();}
    catch(error){console.error('No se pudo completar el respaldo: '+error.message+'. Firebase sigue abierto. Reintenta el cierre antes de apagar la laptop.');closing=false;process.exitCode=1;return;}
  }
  if(terminateClient)await terminateClient().catch(()=>{});
  for(const child of [...children].reverse())stopChild(child);
  console.log('Datos guardados. Servicios cerrados.');
  if(process.connected)process.disconnect();
}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
process.on('message',message=>{if(message?.type==='shutdown')void shutdown();});
async function waitFor(url, child, seconds = 180) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end && !closing && child.exitCode === null) {
    try { const result = await fetch(url, { signal: AbortSignal.timeout(1500) }); if (result.status < 500) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('El servicio no pudo iniciar. Revisa el error indicado arriba. Ejecuta npm.cmd run doctor para comprobar el entorno.');
}
try {
  if (existsSync(lockPath)) {
    const old = JSON.parse(readFileSync(lockPath, 'utf8'));
    let alive = false; try { process.kill(old.pid, 0); alive = true; } catch {}
    if (alive) throw new Error('Este proyecto ya estÃ¡ abierto. Utiliza su terminal o ciÃ©rralo con Ctrl+C antes de volver a iniciar.');
  }
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid }));
  process.on('exit', () => { try { if (JSON.parse(readFileSync(lockPath, 'utf8')).pid === process.pid) unlinkSync(lockPath); } catch {} });
  const config = JSON.parse(readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  for (const name of ['auth', 'firestore']) {
    const original = config.emulators[name].port;
    config.emulators[name].port = await freePort(original);
    if (original !== config.emulators[name].port) console.log(`${name}: puerto ${original} ocupado; se utilizarÃ¡ ${config.emulators[name].port}.`);
  }
  config.emulators.hub = { host: '127.0.0.1', port: await freePort(4400) };
  config.emulators.logging = { host: '127.0.0.1', port: await freePort(4500) };
  config.chasquero = { apiPort: await freePort(value('--api-port',3001)), webPort: await freePort(value('--port', 5173)), webHost: host, lan };
  if (lan) {
    const links = networkLinks(config.chasquero.webPort);
    if (!links.length) throw new Error('No encontramos una IP de red local. Conéctate al Wi-Fi y vuelve a iniciar.');
    process.env.CHASQUERO_ALLOWED_ORIGINS = [...links.map(link => new URL(link.url).origin), 'http://localhost:' + config.chasquero.webPort, 'http://127.0.0.1:' + config.chasquero.webPort].join(',');
  }
  writeFileSync(path.join(root, '.local-runtime.json'), JSON.stringify(config, null, 2));
  console.log('Iniciando Chasquero Coffee. La primera ejecuciÃ³n puede descargar los emuladores.');
  const backupRoot=path.join(root,'.emulator-data'),saved=findLocalBackup(backupRoot);
  if(!saved&&[backupRoot,backupRoot+'-snapshots'].some(dir=>existsSync(dir)&&readdirSync(dir).length))throw new Error('Hay datos de respaldo, pero ninguna copia válida. Revisa las copias antes de iniciar; no se cargarán datos nuevos sobre un respaldo incompleto.');
  const args = ['emulators:start', '--config', '.local-runtime.json', '--only', 'auth,firestore', '--project', 'demo-chasquero-coffee'];
  if(saved)args.push('--import='+saved);
  const emulator = launch('node_modules/firebase-tools/lib/bin/firebase.js', args);
  await Promise.all([waitFor(`http://127.0.0.1:${config.emulators.auth.port}/`, emulator), waitFor(`http://127.0.0.1:${config.emulators.firestore.port}/`, emulator)]);
  const { seed } = await import('./seed.mjs'); await seed();
  const { db } = await import('../server/firebase.mjs'); terminateClient = () => db.terminate();dataReady=true;
  const api = launch('server/index.mjs');
  await waitFor(`http://127.0.0.1:${config.chasquero.apiPort}/api/health`, api, 20);
  const web = launch('node_modules/vite/bin/vite.js', ['--host', host, '--port', String(config.chasquero.webPort), '--strictPort']);
  await waitFor(`http://127.0.0.1:${config.chasquero.webPort}/api/health`, web, 30);
  const links = lan ? networkLinks(config.chasquero.webPort) : [];
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, webPid: web.pid, apiPid: api.pid, lan, webPort: config.chasquero.webPort, ready: true }));
  if (lan) {
    const guide = ['CHASQUERO COFFEE - ACCESO DESDE EL MISMO WI-FI', '', ...links.map(link => `${link.name}: ${link.url}`), '', 'Abrir el enlace en el navegador de la otra laptop.', 'Cada persona ingresa con su cuenta y su perfil.', 'Todos utilizan los datos guardados en esta laptop.', 'Las otras sesiones actualizan los datos cada 15 segundos.', '', 'Mantener la laptop y el iniciador encendidos.', 'Si no conecta: ejecutar PERMITIR_RED_LOCAL_ADMIN.cmd.', 'Si cambia el Wi-Fi: abrir VER_ENLACE_RED.cmd para consultar la IP actual.'];
    writeFileSync(path.join(root, 'ENLACE_RED_LOCAL.txt'), guide.join('\r\n'), 'utf8');
    for (const link of links) console.log(`\nENLACE PARA OTRAS LAPTOPS (${link.name}): ${link.url}`);
    console.log('\nSi no conecta desde otra laptop, ejecuta PERMITIR_RED_LOCAL_ADMIN.cmd.');
  }
  console.log(`\nAbre http://localhost:${config.chasquero.webPort}\nCierra con Ctrl+C una vez para guardar los datos locales.`);
} catch (error) { console.error(error.message); process.exitCode = 1; shutdown(); }
