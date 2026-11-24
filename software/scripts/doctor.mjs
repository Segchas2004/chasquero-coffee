import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
console.log(`Node: ${process.version} (usa Node 22 LTS para esta entrega)`);
const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
console.log(java.error ? 'Java no está disponible en PATH. Instala JDK 21.' : java.stderr || java.stdout);
console.log(existsSync('node_modules/firebase-tools') ? 'Dependencias instaladas.' : 'Ejecuta npm.cmd ci en esta carpeta.');
console.log('El arranque selecciona puertos libres y comparte la configuración entre Firebase, API y web.');
