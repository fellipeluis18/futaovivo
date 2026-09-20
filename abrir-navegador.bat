@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado.
  echo Instale Node.js em https://nodejs.org/ e execute este arquivo novamente.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo Instalando dependencias do navegador...
  call npm.cmd install
  if errorlevel 1 (
    echo Falha ao instalar as dependencias.
    pause
    exit /b 1
  )
)

call npm.cmd start
endlocal