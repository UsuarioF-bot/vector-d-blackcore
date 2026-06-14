@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set "ROOT=%~dp0"
set "TRIES=0"

title VET-MIS - Iniciando

echo.
echo  ========================================
echo    VET-MIS - Inicio automatico
echo    Solo Node.js (sin npm / pnpm)
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js no esta instalado.
    echo  Descargalo en: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  Node:
node -v
echo.

if not exist "%ROOT%server\node_modules\express\" (
    echo  [ERROR] Faltan dependencias del servidor.
    goto need_install
)
if not exist "%ROOT%client\node_modules\vite\" (
    echo  [ERROR] Faltan dependencias del cliente.
    goto need_install
)
echo  [1/4] Dependencias OK
goto start_services

:need_install
echo.
echo  Ejecuta primero: Instalar-dependencias.bat
echo.
pause
exit /b 1

:start_services
echo  [2/4] Preparado
echo.

call :api_up
if errorlevel 1 goto api_failed

echo  [4/4] Comprobando web (puerto 3000)...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo       Iniciando interfaz web...
    start "VET-MIS Web" cmd /k ""%ROOT%scripts\iniciar-web.cmd""
    echo       Esperando Vite...
    timeout /t 5 /nobreak >nul
) else (
    echo       Web ya estaba activa
)

echo.
echo  Abriendo navegador...
start "" "http://localhost:3000"

echo.
echo  ========================================
echo    Listo
echo  ========================================
echo.
echo    App:     http://localhost:3000
echo    API:     http://localhost:3001
echo    Base de datos: server\vet_mis.db
echo.
echo    Deja abiertas las ventanas "VET-MIS API" y "VET-MIS Web".
echo    Para detener: Detener-VET-MIS.bat
echo    Si la API falla: Reparar-dependencias.bat
echo.
pause
exit /b 0

:api_failed
echo.
echo  [ERROR] La API no arranco en el puerto 3001.
echo  - Revisa la ventana "VET-MIS API"
echo  - Si dice SQLite: ejecuta Reparar-dependencias.bat
echo  - Luego vuelve a ejecutar este archivo
echo.
pause
exit /b 1

:api_up
echo  [3/4] Comprobando API (puerto 3001)...
set "TRIES=0"
:api_check
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3001/api/dashboard/stats' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo       API lista en http://localhost:3001
    exit /b 0
)
if !TRIES! equ 0 (
    echo       Iniciando API...
    start "VET-MIS API" cmd /k ""%ROOT%scripts\iniciar-api.cmd""
)
timeout /t 2 /nobreak >nul
set /a TRIES+=1
if !TRIES! lss 25 goto api_check
echo  [AVISO] La API no respondio a tiempo.
exit /b 1
