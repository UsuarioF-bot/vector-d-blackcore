@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
set "ROOT=%~dp0"
set "PNPM=%ROOT%tools\pnpm.exe"

echo.
echo  ========================================
echo    VET-MIS - Reparar modulos nativos
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Necesitas Node.js: https://nodejs.org
    pause
    exit /b 1
)

if not exist "%PNPM%" (
    echo  No hay pnpm portable. Ejecuta Instalar-dependencias.bat primero.
    pause
    exit /b 1
)

echo  Node:
node -v
echo.
echo  Recompilando better-sqlite3 y canvas...
echo.

pushd "%ROOT%"
call "%PNPM%" rebuild better-sqlite3 canvas --filter vet-mis-server
set "ERR=%ERRORLEVEL%"
popd

if not "%ERR%"=="0" (
    echo.
    echo  [ERROR] Fallo la reparacion. Prueba Instalar-dependencias.bat
    pause
    exit /b 1
)

echo.
echo  Comprobando modulos nativos...
pushd "%ROOT%server"
node -e "require('better-sqlite3'); console.log('  better-sqlite3 OK')"
set "ERR=%ERRORLEVEL%"
if "%ERR%"=="0" (
  node -e "try { const {ChartJSNodeCanvas}=require('chartjs-node-canvas'); new ChartJSNodeCanvas({width:10,height:10}); console.log('  canvas OK'); } catch(e) { console.log('  canvas omitido (PDF sin graficos):', e.message); }"
)
popd

if not "%ERR%"=="0" (
    echo  [ERROR] Sigue fallando. Ejecuta Instalar-dependencias.bat
    pause
    exit /b 1
)

echo.
echo  Reparado. Usa Iniciar-VET-MIS.bat
echo.
pause
