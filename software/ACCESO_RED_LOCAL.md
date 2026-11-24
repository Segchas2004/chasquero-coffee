# Acceso desde otras laptops en el mismo Wi-Fi

Actualizado el 17 de noviembre de 2026.

## En la laptop que contiene el proyecto

Para hacerlo con un solo archivo, abrimos `ABRIR_CHASQUERO.cmd` o el acceso directo `Chasquero Coffee` del escritorio. Inicia los servicios, comprueba el firewall, muestra el enlace vigente, lo guarda en `ENLACE_RED_LOCAL.txt` y abre la pagina de acceso en el navegador. Si el sistema ya esta abierto en modo de red, reutiliza esa sesion. Windows solo solicita permiso cuando la regla del puerto necesita configurarse.

Los pasos siguientes quedan disponibles para iniciar o diagnosticar cada parte por separado.

1. Conectamos la laptop y los otros equipos al mismo Wi-Fi o al mismo punto de acceso del teléfono.
2. Abrimos `INICIAR_RED_LOCAL.cmd`. Esperamos el mensaje `ENLACE PARA OTRAS LAPTOPS`.
3. Ejecutamos `PERMITIR_RED_LOCAL_ADMIN.cmd` y aceptamos el aviso de administrador de Windows. La regla utiliza el puerto real del iniciador, permite redes privadas y públicas y limita el acceso a la misma subred y al programa Node.js.
4. Compartimos el enlace completo que aparece en `ENLACE_RED_LOCAL.txt`, incluido `http`, la IP y el puerto. También podemos consultarlo con `VER_ENLACE_RED.cmd`.

Cada persona abre ese enlace en su navegador e ingresa con su cuenta. Las cuentas locales de demostración se indican en README.md. Las cuentas reales de Firebase corresponden al entorno de nube.

La API y los emuladores permanecen en la laptop anfitriona. Todos los navegadores utilizan la misma base de datos. Cada sesión mantiene su perfil y permisos. Al guardar una operación, la sesión que la registró se actualiza de inmediato; los otros usuarios reciben los datos en la siguiente actualización automática, cada 15 segundos, o mediante el botón Actualizar datos.

## Cuando cambiamos de Wi-Fi

La IP puede cambiar. Usamos `VER_ENLACE_RED.cmd` para comprobar la dirección actual. Si reiniciamos el programa, el iniciador genera de nuevo `ENLACE_RED_LOCAL.txt`. Si el puerto cambió por estar ocupado, repetimos `PERMITIR_RED_LOCAL_ADMIN.cmd` para actualizar la regla.

`127.0.0.1` y `localhost` sirven para entrar desde la laptop anfitriona. En los otros equipos usamos la IP de red que muestra el iniciador.

## Si no conecta

Comprobamos primero que la ventana del iniciador siga abierta. En la otra laptop abrimos la dirección compartida terminada en `/api/health`. Debe mostrar un JSON con `ok: true`. Si se agota el tiempo, revisamos la autorización de Windows y la conexión al mismo Wi-Fi. Algunas redes de invitados o de universidades aíslan los equipos; en ese caso usamos una red que permita conexiones entre dispositivos, como un punto de acceso propio con esa opción habilitada.

La laptop anfitriona debe permanecer encendida, conectada y sin suspensión durante el uso. Cerramos el iniciador con Ctrl+C y esperamos la exportación al terminar. La persistencia de los registros del servidor es independiente del cierre de un navegador.

## Comprobación técnica

`npm run test:lan` comprueba selección de IP, cambio de red, puerto vigente, origen y generación de identificadores en HTTP. Con el sistema iniciado en modo LAN, `npm run test:integration:lan` comprueba la web, dos sesiones independientes, datos compartidos y permisos a través de la IP actual. Esta prueba crea y elimina únicamente un contacto temporal propio. La comprobación desde una segunda laptop debe realizarse sobre el enlace mostrado para esa red.
