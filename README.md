# Chasquero Coffee

La versión completa está en `software/`: web empresarial y sistema de compras, inventario, secado, procesos, ventas, abonos, tesorería, reportes y auditoría.

Preparación del 24/11/2026 para cierre el 30/11 y revisión el 01/12/2026. El prototipo HTML anterior se conserva en la raíz. La aplicación completa se publica mediante Firebase Hosting y Functions; GitHub Pages no ejecuta su API.

## Iniciar

Entra en `software/`, instala Node.js 22.12 o posterior y Java 21 y abre `ABRIR_CHASQUERO.cmd`. El iniciador instala las dependencias si faltan. Conserva `.emulator-data-snapshots` y cualquier `.emulator-data` anterior para mantener datos locales. Cierra con Ctrl+C y espera la confirmación de guardado.

## Verificar

En `software/`: `npm ci`, `npm run test:all` y `npm run build`. Las integraciones necesitan los emuladores y la API local activos. Las pruebas de dominio y los datos de práctica no son operaciones de clientes reales.

## Firebase

`software/.firebaserc` apunta al proyecto `chasquero-coffee-261013`. `PUBLICAR_FIREBASE.cmd` prepara y despliega mediante la sesión local del propietario; no guarda credenciales en Git ni activa facturación. Functions requiere Blaze. Las tarifas reales, las cuentas y la prueba completa del dominio publicado deben confirmarse antes de operar.

Los documentos académicos y las copias de datos se entregan por separado para Drive. La rama de entrega permite revisar el código antes de publicarlo.
