@echo off
cd /d "%~dp0..\client"
title VET-MIS Web
echo  Web en http://localhost:3000
echo  Carpeta: %CD%
echo.

if not exist "node_modules\vite\bin\vite.js" (
    echo  [ERROR] Falta Vite. Ejecuta Instalar-dependencias.bat
    pause
    exit /b 1
)

set "TRIES=0"
:wait_api
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3001/api/dashboard/stats' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto api_ready
if %TRIES% geq 15 (
    echo  [ERROR] La API no responde en http://localhost:3001
    echo  Abre otra ventana con Iniciar-VET-MIS.bat o revisa "VET-MIS API".
    echo  Si falla SQLite: Reparar-dependencias.bat
    echo.
    pause
    exit /b 1
)
if %TRIES% equ 0 echo  Esperando a que la API este lista...
timeout /t 2 /nobreak >nul
set /a TRIES+=1
goto wait_api

:api_ready
echo  API conectada.
echo.
node "node_modules\vite\bin\vite.js"
