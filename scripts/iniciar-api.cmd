@echo off
cd /d "%~dp0..\server"
title VET-MIS API
echo  API en http://localhost:3001
echo  Carpeta: %CD%
echo.

node -e "require('better-sqlite3')" >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Falta el modulo nativo de SQLite.
    echo  Ejecuta Reparar-dependencias.bat en la carpeta del proyecto.
    echo.
    pause
    exit /b 1
)

node index.js
if errorlevel 1 (
    echo.
    echo  [ERROR] La API se detuvo. Revisa el mensaje de arriba.
    pause
)
