@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto :missingNode
if exist node_modules\vite\bin\vite.js goto :run
echo Instalando dependencias de Chasquero Coffee...
call npm.cmd ci
if errorlevel 1 goto :failed
:run
echo Iniciando web y sistema local. Mantener abierta esta ventana.
call npm.cmd run start:local
goto :end
:missingNode
echo Instala Node.js 22.12 o posterior. Consulta README.md.
goto :end
:failed
echo No se pudieron instalar las dependencias. Revisa la conexion y el mensaje anterior.
:end
pause
