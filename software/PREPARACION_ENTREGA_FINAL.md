# Preparación de la entrega del 30 de noviembre de 2026

Actualización comprobada el 24/11/2026. Revisión académica prevista: 01/12/2026.

Incluye la tabla de humedad confirmada, lectura entera sin redondeo, divisor manual mínimo 75.5 sobre 40 %, envío a secado con fecha y especificación, bloqueo del peso enviado, pesaje final, humedad y rendimiento, merma, análisis estimado y venta del lote seco con liquidación por rendimiento. Las compras anteriores conservan sus importes.

Verificación local: 111 pruebas automáticas y compilación aprobadas; 43 comprobaciones de integración y 7 de inicio, cierre y recuperación en copias independientes. Estas pruebas locales se complementan con las comprobaciones de publicación indicadas abajo.

Para iniciar usamos ABRIR_CHASQUERO.cmd. Cerramos con Ctrl+C y esperamos el mensaje Datos guardados. Las copias nuevas están en .emulator-data-snapshots; conservamos esa carpeta y cualquier .emulator-data anterior. El inicio elige la última copia válida y evita cargar datos nuevos si solo encuentra respaldos incompletos. Los archivos de datos, cuentas y configuración privada no se incluyen en Git.

Para Firebase usamos Authentication, Firestore, Functions y Hosting. PUBLICAR_FIREBASE.cmd comprueba la facturación, prepara el parámetro de Authentication, compila, despliega la API y después la web, y ejecuta comprobaciones iniciales del dominio. No activa la facturación ni carga datos de demostración. El proyecto seleccionado está en .firebaserc. El propietario debe habilitar Blaze para Functions y confirmar las tarifas y las cuentas reales antes de operar. La página pública de GitHub Pages no ejecuta la API de este software.

REGLAS_PERGAMINO.md contiene la regla actual. Los manuales anteriores conservan ejemplos históricos; para humedad y secado se usa el manual actualizado de la entrega final. Las tarifas de ejemplo no son precios reales autorizados.

## Publicación del 24/11/2026

Blaze está habilitado por el propietario. Functions, Hosting y las reglas de Firestore están publicados. Web: https://chasquero-coffee-261013.web.app/ . Sistema: https://chasquero-coffee-261013.web.app/acceso .

Las cuatro comprobaciones iniciales de la web publicada están aprobadas: web compilada, API con Firebase real, sesión obligatoria para datos y reportes y rechazo de escrituras desde otro origen. La cuenta inicial de administración está activa. La base de producción no se rellenó con datos de demostración ni tarifas ficticias.

Administración puede crear los demás accesos desde Usuarios y permisos. Quedan por cargar las tarifas autorizadas y completar las pruebas de los perfiles y del flujo de negocio en el sitio publicado antes de registrar operaciones reales. El código está en la rama main de https://github.com/Segchas2004/chasquero-coffee .
