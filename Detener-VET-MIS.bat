@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

title VET-MIS — Detener

echo.
echo  Deteniendo procesos en puertos 3000 y 3001...
echo.

powershell -NoProfile -Command ^
  "$ports = 3000, 3001; " ^
  "foreach ($port in $ports) { " ^
  "  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | " ^
  "  ForEach-Object { " ^
  "    $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; " ^
  "    if ($p) { Write-Host ('  Puerto ' + $port + ': deteniendo ' + $p.ProcessName + ' (PID ' + $_.OwningProcess + ')'); " ^
  "      Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } " ^
  "  } " ^
  "}"

echo.
echo  Hecho. Puedes volver a iniciar con Iniciar-VET-MIS.bat
echo.
pause
