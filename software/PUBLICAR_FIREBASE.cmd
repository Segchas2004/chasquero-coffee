@echo off
setlocal
cd /d "%~dp0"
echo Publicar Chasquero Coffee en Firebase
echo Usa tu sesion de Firebase CLI. No activa facturacion ni carga datos de demostracion.
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22.12 o posterior antes de continuar.
  pause
  exit /b 1
)
node scripts/publish.mjs
set "publishExit=%errorlevel%"
pause
exit /b %publishExit%
