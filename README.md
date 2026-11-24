# Chasquero Coffee

La versión completa está en `software/`: web empresarial y sistema de compras, inventario, secado, procesos, ventas, abonos, tesorería, reportes y auditoría.

Versión publicada el 24/11/2026 para cierre el 30/11 y revisión el 01/12/2026. El prototipo HTML anterior se conserva en la raíz. La aplicación completa utiliza Firebase Hosting, Functions, Authentication y Firestore.

## Sitio y acceso al sistema

- Web: https://chasquero-coffee-261013.web.app/
- Acceso: https://chasquero-coffee-261013.web.app/acceso

Los usuarios pueden entrar por Internet sin mantener una laptop como servidor. La cuenta inicial de administración gestiona los demás accesos desde Usuarios y permisos. Los datos de los emuladores locales se conservan por separado.

## Iniciar

Entra en `software/`, instala Node.js 22.12 o posterior y Java 21 y abre `ABRIR_CHASQUERO.cmd`. El iniciador instala las dependencias si faltan. Conserva `.emulator-data-snapshots` y cualquier `.emulator-data` anterior para mantener datos locales. Cierra con Ctrl+C y espera la confirmación de guardado.

## Verificar

En `software/`: `npm ci`, `npm run test:all` y `npm run build`. Las integraciones necesitan los emuladores y la API local activos. Las pruebas de dominio y los datos de práctica no son operaciones de clientes reales.

## Firebase

`software/.firebaserc` apunta al proyecto `chasquero-coffee-261013`. Blaze está habilitado por el propietario. `PUBLICAR_FIREBASE.cmd` prepara y despliega actualizaciones mediante su sesión local; no guarda credenciales en Git ni activa facturación.

Se comprobaron 111 pruebas automáticas, la compilación y cuatro comprobaciones iniciales del sitio publicado. Antes de operar con clientes reales se deben cargar las tarifas autorizadas, crear las cuentas de empleados y completar las pruebas por perfil en la web publicada.

Los documentos académicos y las copias de datos se entregan por separado para Drive. El código publicado está en main y en entrega-final-2026-11-30.
