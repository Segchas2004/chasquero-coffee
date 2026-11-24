@echo off
title Chasquero Coffee - Iniciar y compartir
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto :missingNode
if exist node_modules\vite\bin\vite.js goto :run
echo Preparando Chasquero Coffee por primera vez...
call npm.cmd ci
if errorlevel 1 goto :failed
:run
node scripts\start-all.mjs
goto :end
:missingNode
echo Instala Node.js 22.12 o posterior para iniciar el sistema.
goto :end
:failed
echo No se pudieron instalar las dependencias. Revisa la conexion y el mensaje anterior.
:end
pause
