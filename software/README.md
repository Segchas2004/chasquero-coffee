## Actualización del 24 de noviembre de 2026

La versión actual incorpora tabla completa de humedad, secado por lotes y liquidación del café seco. Consulta PREPARACION_ENTREGA_FINAL.md y REGLAS_PERGAMINO.md. La compilación y 111 pruebas automáticas aprobaron, junto con 43 comprobaciones de integración y 7 del ciclo de inicio, cierre y recuperación en entornos separados.

Para conservar los datos locales guarda la carpeta `.emulator-data-snapshots` completa y cualquier `.emulator-data` anterior. Cierra con Ctrl+C y espera la confirmación de guardado. Cada cierre crea una copia independiente; el siguiente inicio selecciona la última válida.

La publicación preparada usa `PUBLICAR_FIREBASE.cmd`, Authentication, Firestore, Functions y Hosting. El proyecto sigue sin facturación habilitada: Functions requiere Blaze. Las tarifas reales y las pruebas del dominio publicado están pendientes. Los pasos y resultados antiguos que siguen corresponden a sus fechas de revisión.

# Chasquero Coffee

Web empresarial y sistema administrativo con React, API Express y Firebase.

## Entrega actual del Sprint 4

Verificada el 23/11/2026. Ventas con stock y reservas, abonos y pagos idempotentes, caja manual y anulaciones compensatorias. Corregimos la aparición de operaciones devueltas entre las deudas pendientes y reforzamos los límites de formularios. Manual ilustrado, informe de cambios, cronograma ajustado y evidencias: `documentacion/Sprint_04`. Ver `CAMBIOS_SPRINT04.md`.

`npm.cmd run test:all`: 82 casos automáticos. `npm.cmd run test:integration:sprint4`: diez comprobaciones contra emuladores. Las evidencias de esta entrega se obtuvieron en una copia aislada del proyecto, sin modificar registros del entorno habitual.

## Entrega anterior del Sprint 3

Verificada el 03/11/2026: compra con pago parcial y lote, saldo y egreso inicial, inventario con filtros y alertas, procesamiento con merma medida y trazabilidad. Los tres manuales ilustrados, la EDT corregida y la matriz de sus 24 actividades están en `documentacion/Sprint_03`. Ver también CUMPLIMIENTO_SPRINT03.md.

## Ejecutar en Windows

Para utilizarlo desde otras laptops del mismo Wi-Fi, abrimos `INICIAR_RED_LOCAL.cmd` y después `PERMITIR_RED_LOCAL_ADMIN.cmd`. Compartimos el enlace vigente que aparece en `ENLACE_RED_LOCAL.txt`. La regla del firewall usa el puerto real y admite redes privadas y públicas, limitada a la misma subred. Ver ACCESO_RED_LOCAL.md. Los demás equipos utilizan el navegador y los datos de esta laptop.

También podemos abrir `ABRIR_CHASQUERO.cmd` o el acceso directo `Chasquero Coffee` del escritorio para iniciar todo, comprobar el permiso de red, mostrar el enlace y abrir el sistema en el navegador con un solo doble clic.

Requisitos: Node 22.12 o posterior y Java 21 para Firestore local.

```powershell
npm.cmd ci
npm.cmd run start:local
```

Abrir la dirección que indique la terminal. La portada está en / y el sistema en /acceso.

Las cuentas LOCALES de demostración utilizan la contraseña CafeLocal2026!:

| Perfil | Correo local |
|---|---|
| Administrador | administracion@chasquero.local |
| Gerente | director@chasquero.local |
| Almacén | almacen@chasquero.local |
| Caja | caja@chasquero.local |

Estos accesos son ficticios y no existen en el proyecto real. La contraseña real la administra el propietario desde Firebase; no se almacena en el código.

## Entrega y Firebase

Proyecto real: **chasquero-coffee-261013**, Chasquero Coffee - Entrega.

Authentication por correo/contraseña y Firestore Standard están configurados. La cuenta inicial del propietario está habilitada como administrador. La base real no contiene operaciones ficticias. Las reglas bloquean el acceso directo del navegador; las operaciones se ejecutan a través de la API autenticada.

Functions y Hosting están preparados en el código, pero **no se publicaron**. El proyecto sigue sin facturación habilitada. El despliegue de Functions requiere que el propietario habilite un plan compatible con facturación; no se activó ningún pago.

Cuando se decida publicar y esté habilitada la facturación:

```powershell
npm.cmd exec -- firebase login
npm.cmd run deploy:firebase
```

El comando prepara el parámetro de Authentication desde firebase-web-config.json, compila y despliega. No subir cuentas de servicio ni archivos de credenciales a GitHub. El archivo de configuración web contiene identificadores públicos de Firebase, no una clave privada de administración.

## Pergamino

Rendimientos enteros desde 80 hasta 40. Cada rendimiento tiene una tarifa independiente. En COMPRAS de pergamino se aplica la liquidación confirmada por la empresa; en las demás presentaciones y en ventas se conserva el cálculo por kilo que existía en el sistema, hasta que la empresa indique otra regla.

Peso bruto ÷ divisor de humedad → cortar a dos decimales → multiplicar por precio del rendimiento → descartar céntimos del pago final.

Ejemplo: 50 ÷ 56,5 → 0,88; 0,88 × 980 = 862,40; total a pagar **S/ 862**. El inventario recibe los 50 kg físicos. Ver REGLAS_PERGAMINO.md.

## Verificación

```powershell
npm.cmd run build
npm.cmd run test:all
# Con start:local abierto:
npm.cmd run test:integration:sprint3
```

Verificación del 03/11/2026: 59 pruebas generales aprobadas, siete de integración del Sprint 3 aprobadas y diez comprobaciones en navegador aprobadas. TypeScript y compilación web sin errores. La integración comprueba persistencia en Firestore Emulator y usa únicamente registros de prueba propios. Los resultados se conservan en `documentacion/Sprint_03/Evidencias`. Esta comprobación local no acredita un despliegue ni un acceso en una web publicada.

Las pruebas de otras entregas siguen disponibles en `test:integration`, `test:access` y `test:reports`; no se suman a la verificación de esta fecha porque no se ejecutaron en esta revisión.

Ver ENTREGA.md para el alcance y los pendientes.
