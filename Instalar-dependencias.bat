@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
set "ROOT=%~dp0"
set "PNPM=%ROOT%tools\pnpm.exe"

echo.
echo  ========================================
echo    VET-MIS - Instalar dependencias
echo    pnpm portable (no usa npm)
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Necesitas Node.js: https://nodejs.org
    pause
    exit /b 1
)

if not exist "%ROOT%tools\" mkdir "%ROOT%tools\"

if not exist "%PNPM%" (
    echo  Descargando pnpm portable...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$u='https://github.com/pnpm/pnpm/releases/download/v10.12.4/pnpm-win-x64.exe';" ^
        "try { Invoke-WebRequest -Uri $u -OutFile '%PNPM%' -UseBasicParsing } catch { exit 1 }"
    if errorlevel 1 (
        echo  [ERROR] No se pudo descargar pnpm. Revisa tu conexion a internet.
        pause
        exit /b 1
    )
)

echo  pnpm:
"%PNPM%" -v
echo.
echo  Instalando paquetes...
echo.

pushd "%ROOT%"
call "%PNPM%" install
set "ERR=%ERRORLEVEL%"
popd

if not "%ERR%"=="0" (
    echo.
    echo  [ERROR] Fallo la instalacion
    pause
    exit /b 1
)

echo.
echo  Compilando modulos nativos (SQLite, canvas)...
echo.

pushd "%ROOT%"
call "%PNPM%" rebuild better-sqlite3 canvas --filter vet-mis-server
set "ERR=%ERRORLEVEL%"
popd

if not "%ERR%"=="0" (
    echo.
    echo  [AVISO] Algun modulo nativo no compilo. Prueba Reparar-dependencias.bat
)

echo.
echo  Listo. Usa Iniciar-VET-MIS.bat para arrancar (solo Node.js).
echo.
pause
