@echo off
cd /d "%~dp0"
echo Conectar la cuenta propietaria de Firebase. No publiques codigos ni contrasenas en el chat.
call npm.cmd exec -- firebase login
echo.
echo Consulta ENTREGA.md para crear y configurar el proyecto real.
pause
